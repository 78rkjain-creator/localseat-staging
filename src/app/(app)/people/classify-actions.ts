"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasMinimumRole } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { sanitizeText } from "@/lib/sanitize";
import { Role, OutOfDistrictApprovalStatus, ListSource } from "@prisma/client";

// ── Single person classification (used by legacy simple modal) ─────────────────

export async function classifyPerson(
  personId: string,
  isOutOfDistrict: boolean
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeRole || !hasMinimumRole(activeRole as Role, Role.field_organizer)) {
    return { error: "Permission denied." };
  }

  const person = await db.person.findFirst({
    where: { id: personId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true, listSource: true },
  });
  if (!person) return { error: "Person not found." };

  const approvalStatus = isOutOfDistrict
    ? (person.listSource === ListSource.team
        ? OutOfDistrictApprovalStatus.approved
        : OutOfDistrictApprovalStatus.pending)
    : null;

  await db.person.update({
    where: { id: personId },
    data: {
      isOutOfDistrict,
      needsDistrictClassification: false,
      outOfDistrictApprovalStatus: approvalStatus,
    },
  });

  revalidatePath("/people");
  return {};
}

// ── Bulk classification (bulk classify modal from Master List banner) ───────────

export interface BulkClassifyItem {
  personId: string;
  decision: "inside" | "outside";
  addressId?: string;
  streetNumber?: string;
  streetName?: string;
  unitNumber?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

export async function bulkClassifyTeamMembers(
  items: BulkClassifyItem[]
): Promise<{ error?: string; itemErrors?: Record<string, string> }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeRole || !hasMinimumRole(activeRole as Role, Role.field_organizer)) {
    return { error: "Permission denied." };
  }

  if (items.length === 0) return {};

  const itemErrors: Record<string, string> = {};

  for (const item of items) {
    const person = await db.person.findFirst({
      where: { id: item.personId, campaignId: activeCampaignId, deletedAt: null },
      select: { id: true, listSource: true },
    });
    if (!person) {
      itemErrors[item.personId] = "Person not found.";
      continue;
    }

    let resolvedAddressId: string | null = null;

    if (item.decision === "inside") {
      if (item.addressId?.trim()) {
        const addr = await db.address.findFirst({
          where: { id: item.addressId.trim(), campaignId: activeCampaignId, deletedAt: null },
          select: { id: true },
        });
        if (!addr) {
          itemErrors[item.personId] = "Address not found.";
          continue;
        }
        resolvedAddressId = addr.id;
      } else if (item.streetNumber || item.streetName) {
        const streetNumber = sanitizeText(item.streetNumber, 20);
        const streetName = sanitizeText(item.streetName, 100);
        const city = sanitizeText(item.city, 100);
        const province = sanitizeText(item.province, 50) || "ON";
        const postalCode = item.postalCode?.trim().replace(/\s/g, "").toUpperCase() || null;
        const unitNumber = sanitizeText(item.unitNumber, 20);

        if (!streetNumber || !streetName || !city || !postalCode) {
          itemErrors[item.personId] = "Incomplete address.";
          continue;
        }

        let addr = await db.address.findFirst({
          where: {
            campaignId: activeCampaignId,
            deletedAt: null,
            streetNumber: { equals: streetNumber, mode: "insensitive" },
            streetName: { equals: streetName, mode: "insensitive" },
            unitNumber: unitNumber ? { equals: unitNumber, mode: "insensitive" } : null,
            postalCode: { equals: postalCode, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (!addr) {
          addr = await db.address.create({
            data: { campaignId: activeCampaignId, streetNumber, streetName, unitNumber, city, province, postalCode },
            select: { id: true },
          });
        }
        resolvedAddressId = addr.id;
      } else {
        itemErrors[item.personId] = "Address is required for in-district classification.";
        continue;
      }
    }

    let householdId: string | undefined;
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

    const isOutOfDistrict = item.decision === "outside";
    // Team members are auto-approved; imported residents go to pending for FO review
    const approvalStatus = isOutOfDistrict
      ? (person.listSource === ListSource.team
          ? OutOfDistrictApprovalStatus.approved
          : OutOfDistrictApprovalStatus.pending)
      : null;

    await db.person.update({
      where: { id: item.personId },
      data: {
        isOutOfDistrict,
        outOfDistrictApprovalStatus: approvalStatus,
        needsDistrictClassification: false,
        ...(householdId !== undefined ? { householdId } : {}),
      },
    });

    await createAuditLog({
      campaignId: activeCampaignId,
      userId: session.user.id,
      action: "PERSON_DISTRICT_CLASSIFIED",
      entityType: "person",
      entityId: item.personId,
      details: {
        isOutOfDistrict,
        hasAddress: !!resolvedAddressId,
        source: "bulk_classify",
      },
    });
  }

  revalidatePath("/people");

  if (Object.keys(itemErrors).length > 0) {
    return { itemErrors };
  }
  return {};
}
