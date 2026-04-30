"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasMinimumRole } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { sanitizeText } from "@/lib/sanitize";
import { Role, OutOfDistrictApprovalStatus } from "@prisma/client";

// ── Shared input types ─────────────────────────────────────────────────────────

export interface ClassifyTeamMemberInput {
  personId: string;
  isOutOfDistrict: boolean;
  // Address fields required when isOutOfDistrict = false
  addressId?: string;
  streetNumber?: string;
  streetName?: string;
  unitNumber?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

// BulkClassifyItem uses the same superset interface with a decision field
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

// ── Single person classification (legacy simple modal) ────────────────────────

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

  try {
    const person = await db.person.findFirst({
      where: { id: personId, campaignId: activeCampaignId, deletedAt: null },
      select: { id: true },
    });
    if (!person) return { error: "Person not found." };

    const approvalStatus = isOutOfDistrict ? OutOfDistrictApprovalStatus.approved : null;

    await db.person.update({
      where: { id: personId },
      data: { isOutOfDistrict, needsDistrictClassification: false, outOfDistrictApprovalStatus: approvalStatus },
    });

    revalidatePath("/people");
    return {};
  } catch {
    return { error: "Failed to classify person." };
  }
}

// ── Single team member classification (team add modal) ────────────────────────

export async function classifyTeamMember(
  input: ClassifyTeamMemberInput
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeRole || !hasMinimumRole(activeRole as Role, Role.field_organizer)) {
    return { error: "Permission denied." };
  }

  try {
    const person = await db.person.findFirst({
      where: { id: input.personId, campaignId: activeCampaignId, deletedAt: null },
      select: { id: true },
    });
    if (!person) return { error: "Person not found." };

    let resolvedAddressId: string | null = null;
    if (!input.isOutOfDistrict) {
      const result = await resolveAddress(activeCampaignId, input);
      if ("error" in result) return { error: result.error };
      resolvedAddressId = result.addressId;
    }

    const householdId = resolvedAddressId
      ? await resolveHousehold(activeCampaignId, resolvedAddressId)
      : undefined;

    await db.person.update({
      where: { id: input.personId },
      data: {
        isOutOfDistrict: input.isOutOfDistrict,
        outOfDistrictApprovalStatus: input.isOutOfDistrict
          ? OutOfDistrictApprovalStatus.approved
          : null,
        needsDistrictClassification: false,
        ...(householdId !== undefined ? { householdId } : {}),
      },
    });

    await createAuditLog({
      campaignId: activeCampaignId,
      userId: session.user.id,
      action: "PERSON_DISTRICT_CLASSIFIED",
      entityType: "person",
      entityId: input.personId,
      details: { isOutOfDistrict: input.isOutOfDistrict, hasAddress: !!resolvedAddressId, source: "team_add" },
    });

    revalidatePath("/people");
    revalidatePath("/team");
    return {};
  } catch {
    return { error: "Failed to classify team member." };
  }
}

// ── Bulk classification (bulk classify modal from Master List banner) ──────────

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

  try {
  for (const item of items) {
    const person = await db.person.findFirst({
      where: { id: item.personId, campaignId: activeCampaignId, deletedAt: null },
      select: { id: true },
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

    const householdId = resolvedAddressId
      ? await resolveHousehold(activeCampaignId, resolvedAddressId)
      : undefined;

    const isOutOfDistrict = item.decision === "outside";
    const approvalStatus = isOutOfDistrict ? OutOfDistrictApprovalStatus.approved : null;

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
      details: { isOutOfDistrict, hasAddress: !!resolvedAddressId, source: "bulk_classify" },
    });
  }

  revalidatePath("/people");

  if (Object.keys(itemErrors).length > 0) return { itemErrors };
  return {};
  } catch {
    return { error: "Failed to classify people." };
  }
}

// ── Private helpers ────────────────────────────────────────────────────────────

async function resolveAddress(
  campaignId: string,
  input: Pick<
    ClassifyTeamMemberInput,
    "addressId" | "streetNumber" | "streetName" | "unitNumber" | "city" | "province" | "postalCode"
  >
): Promise<{ addressId: string } | { error: string }> {
  if (input.addressId?.trim()) {
    const addr = await db.address.findFirst({
      where: { id: input.addressId.trim(), campaignId, deletedAt: null },
      select: { id: true },
    });
    if (!addr) return { error: "Selected address not found." };
    return { addressId: addr.id };
  }

  const streetNumber = sanitizeText(input.streetNumber, 20);
  const streetName = sanitizeText(input.streetName, 100);
  const city = sanitizeText(input.city, 100);
  const province = sanitizeText(input.province, 50) || "ON";
  const postalCode = input.postalCode?.trim().replace(/\s/g, "").toUpperCase() || null;
  const unitNumber = sanitizeText(input.unitNumber, 20);

  if (!streetNumber) return { error: "Street number is required for in-district classification." };
  if (!streetName) return { error: "Street name is required." };
  if (!city) return { error: "City is required." };
  if (!postalCode) return { error: "Postal code is required." };

  let addr = await db.address.findFirst({
    where: {
      campaignId,
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
      data: { campaignId, streetNumber, streetName, unitNumber, city, province, postalCode },
      select: { id: true },
    });
  }
  return { addressId: addr.id };
}

async function resolveHousehold(campaignId: string, addressId: string): Promise<string> {
  let hh = await db.household.findFirst({
    where: { campaignId, addressId, deletedAt: null },
    select: { id: true },
  });
  if (!hh) {
    hh = await db.household.create({
      data: { campaignId, addressId },
      select: { id: true },
    });
  }
  return hh.id;
}
