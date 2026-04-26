"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasMinimumRole } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { sanitizeText } from "@/lib/sanitize";
import { Role, OutOfDistrictApprovalStatus } from "@prisma/client";

export interface ClassifyTeamMemberInput {
  personId: string;
  isOutOfDistrict: boolean;
  // Required when isOutOfDistrict = false
  addressId?: string;
  streetNumber?: string;
  streetName?: string;
  unitNumber?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

export async function classifyTeamMember(
  input: ClassifyTeamMemberInput
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeRole || !hasMinimumRole(activeRole as Role, Role.field_organizer)) {
    return { error: "Permission denied." };
  }

  const person = await db.person.findFirst({
    where: { id: input.personId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { error: "Person not found." };

  // ── Resolve address (required for in-district) ─────────────────────────────
  let resolvedAddressId: string | null = null;

  if (!input.isOutOfDistrict) {
    const result = await resolveAddress(activeCampaignId, input);
    if ("error" in result) return { error: result.error };
    resolvedAddressId = result.addressId;
  }

  // ── Resolve household ──────────────────────────────────────────────────────
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
    details: {
      isOutOfDistrict: input.isOutOfDistrict,
      hasAddress: !!resolvedAddressId,
      source: "team_add",
    },
  });

  revalidatePath("/people");
  revalidatePath("/team");
  return {};
}

// ── Shared address resolution ──────────────────────────────────────────────────

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
