"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { canManageSigns } from "@/lib/permissions";
import { sanitizeText, sanitizeEnum } from "@/lib/sanitize";
import { checkSupportWriteAccess } from "@/lib/support-access";
import type { Role } from "@/types";

const SIGN_STATUS_VALUES = ["to_be_installed", "installed"] as const;
const SIGN_LOCATION_TYPE_VALUES = ["residential", "non_residential"] as const;

async function requireSignAccess() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated." } as const;

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canManageSigns(activeRole as Role)) {
    return { error: "You don't have permission to manage signs." } as const;
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! } as const;

  return { session, campaignId: activeCampaignId } as const;
}

// ── Add sign ──────────────────────────────────────────────────────────────────

export interface AddSignInput {
  locationType: "residential" | "non_residential";
  addressId?: string | null;
  locationText?: string | null;
  status: "to_be_installed" | "installed";
  notes?: string | null;
}

export async function addSign(
  input: AddSignInput
): Promise<{ error?: string; signId?: string }> {
  const auth = await requireSignAccess();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  const locationType = sanitizeEnum(input.locationType, [...SIGN_LOCATION_TYPE_VALUES]);
  if (!locationType) return { error: "Invalid location type." };

  const status = sanitizeEnum(input.status, [...SIGN_STATUS_VALUES]);
  if (!status) return { error: "Invalid status." };

  const notes = sanitizeText(input.notes, 1000);

  if (locationType === "residential") {
    if (!input.addressId) return { error: "Address is required for residential signs." };
    // Verify address belongs to this campaign
    const address = await db.address.findFirst({
      where: { id: input.addressId, campaignId, deletedAt: null },
      select: { id: true },
    });
    if (!address) return { error: "Address not found." };
  } else {
    const locationText = sanitizeText(input.locationText, 500);
    if (!locationText) return { error: "Location description is required for non-residential signs." };
  }

  const locationText = locationType === "non_residential"
    ? sanitizeText(input.locationText, 500)
    : null;

  const now = new Date();
  const sign = await db.sign.create({
    data: {
      campaignId,
      locationType,
      status,
      addressId: locationType === "residential" ? (input.addressId ?? null) : null,
      locationText,
      notes,
      addedById: session.user.id,
      ...(status === "installed" ? { installedById: session.user.id, installedAt: now } : {}),
    },
    select: { id: true },
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "SIGN_ADDED",
    entityType: "sign",
    entityId: sign.id,
    details: { locationType, status },
  });

  revalidatePath("/signs");
  return { signId: sign.id };
}

// ── Address search (for add form) ────────────────────────────────────────────

export async function searchAddressesForSigns(
  query: string
): Promise<{ id: string; label: string }[]> {
  if (!query.trim() || query.trim().length < 2) return [];

  const session = await getServerSession(authOptions);
  const campaignId = session?.user?.activeCampaignId;
  if (!campaignId) return [];

  const term = query.trim();
  const addresses = await db.address.findMany({
    where: {
      campaignId,
      deletedAt: null,
      OR: [
        { streetName: { contains: term, mode: "insensitive" } },
        { streetNumber: { contains: term, mode: "insensitive" } },
      ],
    },
    select: { id: true, streetNumber: true, streetName: true, city: true },
    take: 8,
    orderBy: [{ streetName: "asc" }, { streetNumber: "asc" }],
  });

  return addresses.map((a) => ({
    id: a.id,
    label: `${a.streetNumber} ${a.streetName}, ${a.city}`,
  }));
}

// ── Update sign status ────────────────────────────────────────────────────────

export async function updateSignStatus(
  signId: string,
  newStatus: "to_be_installed" | "installed"
): Promise<{ error?: string }> {
  const auth = await requireSignAccess();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  const status = sanitizeEnum(newStatus, [...SIGN_STATUS_VALUES]);
  if (!status) return { error: "Invalid status." };

  const sign = await db.sign.findFirst({
    where: { id: signId, campaignId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!sign) return { error: "Sign not found." };

  const now = new Date();
  await db.sign.update({
    where: { id: signId },
    data: {
      status,
      ...(status === "installed" && sign.status !== "installed"
        ? { installedById: session.user.id, installedAt: now }
        : {}),
    },
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "SIGN_STATUS_UPDATED",
    entityType: "sign",
    entityId: signId,
    details: { previousStatus: sign.status, newStatus: status },
  });

  revalidatePath("/signs");
  return {};
}
