"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageWalkLists } from "@/lib/permissions";
import { previewPeopleFilter } from "@/lib/canvassing";
import { geocodeAddressesForCanvassList } from "@/lib/geocoding";
import type { Prisma } from "@prisma/client";
import type { Role, SupportLevel } from "@/types";

// ── Auth + permission guard ────────────────────────────────────────────────

async function requireListManager(listId: string) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canManageWalkLists(activeRole as Role)) {
    return { error: "You don't have permission to modify walk lists." } as const;
  }

  // Verify list belongs to campaign
  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!list) return { error: "Walk list not found." } as const;

  return { session, campaignId: activeCampaignId } as const;
}

// ── Method 1: Filter-based add ─────────────────────────────────────────────

export interface FilterParams {
  streetNumber?: string;
  streetName?: string;
  postalCode?: string;
  supportLevel?: SupportLevel | "";
  tagId?: string;
  notYetCanvassed?: boolean;
}

export async function addFilteredPeople(
  listId: string,
  filters: FilterParams
): Promise<{ error?: string; added?: number }> {
  const auth = await requireListManager(listId);
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  // Re-run the same query used for preview, but fetch IDs
  const existing = await db.canvassListEntry.findMany({
    where: { canvassListId: listId, deletedAt: null },
    select: { personId: true },
  });
  const existingIds = existing.map((e) => e.personId);

  const where: Prisma.PersonWhereInput = {
    campaignId,
    deletedAt: null,
    id: existingIds.length > 0 ? { notIn: existingIds } : undefined,
  };

  const addressFilter: Prisma.AddressWhereInput = {};
  if (filters.streetName?.trim()) {
    addressFilter.streetName = { contains: filters.streetName.trim(), mode: "insensitive" };
  }
  if (filters.streetNumber?.trim()) {
    addressFilter.streetNumber = { contains: filters.streetNumber.trim(), mode: "insensitive" };
  }
  if (filters.postalCode?.trim()) {
    addressFilter.postalCode = { contains: filters.postalCode.trim().replace(/\s/g, ""), mode: "insensitive" };
  }
  if (Object.keys(addressFilter).length > 0) {
    where.household = { address: addressFilter };
  }

  if (filters.supportLevel) {
    where.canvassResponses = { some: { supportLevel: filters.supportLevel } };
  }

  if (filters.tagId) {
    where.tags = { some: { tagId: filters.tagId } };
  }

  if (filters.notYetCanvassed) {
    where.canvassResponses = { none: {} };
  }

  const people = await db.person.findMany({
    where,
    select: { id: true },
  });

  if (people.length === 0) return { added: 0 };

  await db.canvassListEntry.createMany({
    data: people.map((p) => ({
      canvassListId: listId,
      personId: p.id,
      addedById: session.user.id,
    })),
    skipDuplicates: true,
  });

  revalidatePath(`/canvassing/${listId}`);
  if (people.length > 0) geocodeAddressesForCanvassList(listId);
  return { added: people.length };
}

// ── Method 2: CSV import ──────────────────────────────────────────────────

export interface CsvRow {
  firstName: string;
  lastName: string;
  streetNumber: string;
  streetName: string;
  unitNumber: string;  // empty string when absent
  city: string;
  province: string;
  postalCode: string;
}

export interface CsvImportResult {
  error?: string;
  matched?: number;
  created?: number;
  skipped?: number;
}

export async function importCsvPeople(
  listId: string,
  rows: CsvRow[]
): Promise<CsvImportResult> {
  const auth = await requireListManager(listId);
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows to import." };
  }
  if (rows.length > 1000) {
    return { error: "Maximum 1,000 rows per import." };
  }

  let matched = 0;
  let created = 0;
  let skipped = 0;

  await db.$transaction(async (tx) => {
    for (const row of rows) {
      const firstName = row.firstName.trim();
      const lastName = row.lastName.trim();
      const streetNumber = row.streetNumber.trim();
      const streetName = row.streetName.trim();
      const city = row.city.trim();
      const province = row.province.trim();
      const postalCode = row.postalCode.trim().replace(/\s/g, "").toUpperCase();
      const unitNumber = row.unitNumber?.trim() || null;

      // All mandatory fields must be present — caller is responsible for
      // only sending approved/ready rows, but guard here for safety.
      if (!firstName || !lastName || !streetNumber || !streetName || !city || !province || !postalCode) {
        skipped++;
        continue;
      }

      // 1. Try to match an existing person in this campaign by name + address.
      const existingPerson = await tx.person.findFirst({
        where: {
          campaignId,
          deletedAt: null,
          firstName: { equals: firstName, mode: "insensitive" },
          lastName: { equals: lastName, mode: "insensitive" },
          household: {
            address: {
              streetNumber: { equals: streetNumber, mode: "insensitive" },
              streetName: { equals: streetName, mode: "insensitive" },
              unitNumber: unitNumber
                ? { equals: unitNumber, mode: "insensitive" }
                : null,
              postalCode: { equals: postalCode, mode: "insensitive" },
            },
          },
        },
        select: { id: true },
      });

      let personId: string;

      if (existingPerson) {
        personId = existingPerson.id;
        matched++;
      } else {
        // 2. Find or create address.
        // Household key: streetNumber + streetName + unitNumber + postalCode.
        // Each distinct unit is its own address record and its own household.
        let address = await tx.address.findFirst({
          where: {
            campaignId,
            deletedAt: null,
            streetNumber: { equals: streetNumber, mode: "insensitive" },
            streetName: { equals: streetName, mode: "insensitive" },
            unitNumber: unitNumber
              ? { equals: unitNumber, mode: "insensitive" }
              : null,
            postalCode: { equals: postalCode, mode: "insensitive" },
          },
          select: { id: true },
        });

        if (!address) {
          address = await tx.address.create({
            data: {
              campaignId,
              streetNumber,
              streetName,
              unitNumber,
              city,
              province,
              postalCode,
            },
            select: { id: true },
          });
        }

        // 3. Find or create household at that address.
        let household = await tx.household.findFirst({
          where: { campaignId, addressId: address.id, deletedAt: null },
          select: { id: true },
        });

        if (!household) {
          household = await tx.household.create({
            data: { campaignId, addressId: address.id },
            select: { id: true },
          });
        }

        // 4. Create the person.
        const newPerson = await tx.person.create({
          data: {
            campaignId,
            householdId: household.id,
            firstName,
            lastName,
            sourceNotes: "csv-import",
          },
          select: { id: true },
        });

        personId = newPerson.id;
        created++;
      }

      // 5. Add to list, skip silently if already present.
      const alreadyInList = await tx.canvassListEntry.findUnique({
        where: { canvassListId_personId: { canvassListId: listId, personId } },
        select: { id: true },
      });

      if (alreadyInList) {
        if (existingPerson) matched--;
        else created--;
        skipped++;
        continue;
      }

      await tx.canvassListEntry.create({
        data: { canvassListId: listId, personId, addedById: session.user.id },
      });
    }
  }, { timeout: 30000 });

  revalidatePath(`/canvassing/${listId}`);
  if (matched > 0 || created > 0) geocodeAddressesForCanvassList(listId);
  return { matched, created, skipped };
}

// ── Preview server action (called from client via useTransition) ───────────

export async function previewFilter(
  listId: string,
  filters: FilterParams
): Promise<{ error?: string; count?: number; sample?: string[] }> {
  const auth = await requireListManager(listId);
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  const result = await previewPeopleFilter({
    campaignId,
    listId,
    streetNumber: filters.streetNumber,
    streetName: filters.streetName,
    postalCode: filters.postalCode,
    supportLevel: filters.supportLevel || undefined,
    tagId: filters.tagId,
    notYetCanvassed: filters.notYetCanvassed,
  });

  return result;
}
