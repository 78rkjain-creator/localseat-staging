"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAddResident } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { sanitizeText, sanitizePhone, sanitizeEmail, sanitizeBirthDate } from "@/lib/sanitize";
import { ListSource } from "@prisma/client";
import type { Role } from "@/types";

export interface AddResidentInput {
  firstName: string;
  lastName: string;
  // Existing address from autocomplete
  addressId?: string;
  // New address fields (used when addressId is absent)
  streetNumber?: string;
  streetName?: string;
  unitNumber?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  // Contact
  phoneHome?: string;
  phoneMobile?: string;
  email?: string;
  birthDate?: string;
  // Note + tags
  notes?: string;
  tagIds?: string[];
}

export async function addResident(
  input: AddResidentInput
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canAddResident(activeRole as Role)) {
    return { error: "You don't have permission to add residents." };
  }

  const firstName = sanitizeText(input.firstName, 100);
  const lastName = sanitizeText(input.lastName, 100);
  if (!firstName) return { error: "First name is required." };
  if (!lastName) return { error: "Last name is required." };

  const phoneHome = sanitizePhone(input.phoneHome);
  const phoneMobile = sanitizePhone(input.phoneMobile);
  const email = sanitizeEmail(input.email);
  const birthDate = sanitizeBirthDate(input.birthDate);
  const notes = sanitizeText(input.notes, 2000);
  const tagIds = Array.isArray(input.tagIds) ? input.tagIds.filter(Boolean) : [];
  const unitOverride = sanitizeText(input.unitNumber, 20);

  // ── Resolve address ────────────────────────────────────────────────────────
  let resolvedAddressId: string | null = null;

  if (input.addressId?.trim()) {
    // Existing address selected from autocomplete
    const baseAddr = await db.address.findFirst({
      where: { id: input.addressId.trim(), campaignId: activeCampaignId, deletedAt: null },
      select: {
        id: true,
        streetNumber: true,
        streetName: true,
        unitNumber: true,
        city: true,
        province: true,
        postalCode: true,
      },
    });
    if (!baseAddr) return { error: "Selected address not found." };

    if (unitOverride && unitOverride.toLowerCase() !== (baseAddr.unitNumber ?? "").toLowerCase()) {
      // User wants a specific unit that differs from the selected address — find/create it
      let addr = await db.address.findFirst({
        where: {
          campaignId: activeCampaignId,
          deletedAt: null,
          streetNumber: { equals: baseAddr.streetNumber, mode: "insensitive" },
          streetName: { equals: baseAddr.streetName, mode: "insensitive" },
          unitNumber: { equals: unitOverride, mode: "insensitive" },
          postalCode: { equals: baseAddr.postalCode, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (!addr) {
        addr = await db.address.create({
          data: {
            campaignId: activeCampaignId,
            streetNumber: baseAddr.streetNumber,
            streetName: baseAddr.streetName,
            unitNumber: unitOverride,
            city: baseAddr.city,
            province: baseAddr.province,
            postalCode: baseAddr.postalCode,
          },
          select: { id: true },
        });
      }
      resolvedAddressId = addr.id;
    } else {
      resolvedAddressId = baseAddr.id;
    }
  } else if (input.streetNumber || input.streetName) {
    // Manual address entry
    const streetNumber = sanitizeText(input.streetNumber, 20);
    const streetName = sanitizeText(input.streetName, 100);
    const city = sanitizeText(input.city, 100);
    const province = sanitizeText(input.province, 50) || "ON";
    const postalCode = input.postalCode?.trim().replace(/\s/g, "").toUpperCase() || null;

    if (!streetNumber) return { error: "Street number is required." };
    if (!streetName) return { error: "Street name is required." };
    if (!city) return { error: "City is required." };
    if (!postalCode) return { error: "Postal code is required." };

    let addr = await db.address.findFirst({
      where: {
        campaignId: activeCampaignId,
        deletedAt: null,
        streetNumber: { equals: streetNumber, mode: "insensitive" },
        streetName: { equals: streetName, mode: "insensitive" },
        unitNumber: unitOverride
          ? { equals: unitOverride, mode: "insensitive" }
          : null,
        postalCode: { equals: postalCode, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (!addr) {
      addr = await db.address.create({
        data: {
          campaignId: activeCampaignId,
          streetNumber,
          streetName,
          unitNumber: unitOverride,
          city,
          province,
          postalCode,
        },
        select: { id: true },
      });
    }
    resolvedAddressId = addr.id;
  }
  // Address is optional — person may not have one yet

  // ── Resolve household ──────────────────────────────────────────────────────
  let householdId: string | null = null;
  if (resolvedAddressId) {
    let hh = await db.household.findFirst({
      where: { campaignId: activeCampaignId, addressId: resolvedAddressId, deletedAt: null },
      select: { id: true },
    });
    if (!hh) {
      hh = await db.household.create({
        data: { campaignId: activeCampaignId, addressId: resolvedAddressId },
        select: { id: true },
      });
    }
    householdId = hh.id;
  }

  // ── Create person ──────────────────────────────────────────────────────────
  const person = await db.person.create({
    data: {
      campaignId: activeCampaignId,
      householdId: householdId ?? undefined,
      firstName,
      lastName,
      phoneHome: phoneHome ?? undefined,
      phoneMobile: phoneMobile ?? undefined,
      email: email ?? undefined,
      birthDate: birthDate ?? undefined,
      listSource: ListSource.manual,
      includeInWalkLists: false,
      sourceNotes: "manual-add",
    },
    select: { id: true },
  });

  // ── Note ───────────────────────────────────────────────────────────────────
  if (notes) {
    await db.note.create({
      data: {
        personId: person.id,
        authorId: session.user.id,
        body: notes,
      },
    });
  }

  // ── Tags ───────────────────────────────────────────────────────────────────
  if (tagIds.length > 0) {
    const validTags = await db.tag.findMany({
      where: { id: { in: tagIds }, campaignId: activeCampaignId, deletedAt: null },
      select: { id: true },
    });
    if (validTags.length > 0) {
      await db.personTag.createMany({
        data: validTags.map((t) => ({ personId: person.id, tagId: t.id })),
        skipDuplicates: true,
      });
    }
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "PERSON_CREATED_MANUAL",
    entityType: "person",
    entityId: person.id,
    details: {
      firstName,
      lastName,
      hasAddress: !!resolvedAddressId,
      tagCount: tagIds.length,
      hasNote: !!notes,
    },
  });

  redirect(`/voter-list/${person.id}`);
}
