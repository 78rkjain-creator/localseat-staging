"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { canReviewAddressChanges } from "@/lib/permissions";
import type { Role } from "@/types";

export interface NewAddressData {
  streetNumber: string;
  streetName: string;
  unitNumber?: string;
  city: string;
  province: string;
  postalCode: string;
}

// ── Submit ─────────────────────────────────────────────────────────────────────

export async function submitAddressChangeRequest(params: {
  personId: string;
  campaignId: string;
  oldAddressId: string | null;
  newAddressData: NewAddressData;
  affectedPersonIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { success: false, error: "Unauthorized" };

  const { activeCampaignId } = session.user;
  if (!activeCampaignId || activeCampaignId !== params.campaignId) {
    return { success: false, error: "No active campaign" };
  }

  const person = await db.person.findFirst({
    where: { id: params.personId, campaignId: params.campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { success: false, error: "Person not found" };

  const request = await db.addressChangeRequest.create({
    data: {
      campaignId: params.campaignId,
      requestedByUserId: session.user.id,
      personId: params.personId,
      affectedPersonIds: params.affectedPersonIds,
      oldAddressId: params.oldAddressId,
      // Prisma expects a plain JSON-serialisable object for Json columns
      newAddressData: params.newAddressData as unknown as Record<string, string>,
    },
  });

  await createAuditLog({
    campaignId: params.campaignId,
    userId: session.user.id,
    action: "ADDRESS_CHANGE_REQUESTED",
    entityType: "address_change_request",
    entityId: request.id,
    details: {
      newAddressData: params.newAddressData,
      affectedPersonIds: params.affectedPersonIds,
    },
  });

  return { success: true };
}

// ── Pending count (for dashboard badges) ──────────────────────────────────────

export async function getPendingAddressChangeCount(campaignId: string): Promise<number> {
  return db.addressChangeRequest.count({
    where: { campaignId, status: "pending", deletedAt: null },
  });
}

// ── List pending requests ──────────────────────────────────────────────────────

export async function getPendingAddressChangeRequests(campaignId: string) {
  return db.addressChangeRequest.findMany({
    where: { campaignId, status: "pending", deletedAt: null },
    include: {
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          household: {
            include: {
              address: true,
              people: {
                where: { deletedAt: null },
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
      requestedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

// ── Approve ────────────────────────────────────────────────────────────────────

export async function approveAddressChangeRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { success: false, error: "Unauthorized" };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { success: false, error: "No active campaign" };
  if (!activeRole || !canReviewAddressChanges(activeRole as Role)) {
    return { success: false, error: "Forbidden" };
  }

  const request = await db.addressChangeRequest.findFirst({
    where: { id: requestId, campaignId: activeCampaignId, status: "pending", deletedAt: null },
  });
  if (!request) return { success: false, error: "Request not found or already reviewed" };

  const newData = request.newAddressData as unknown as NewAddressData;
  const normalizedPostal = newData.postalCode.trim().toUpperCase().replace(/\s/g, "");

  // Find or create the address record
  let address = await db.address.findFirst({
    where: {
      campaignId: activeCampaignId,
      streetNumber: newData.streetNumber.trim(),
      streetName: { equals: newData.streetName.trim(), mode: "insensitive" },
      unitNumber: newData.unitNumber?.trim() || null,
      city: { equals: newData.city.trim(), mode: "insensitive" },
      postalCode: normalizedPostal,
      deletedAt: null,
    },
  });
  if (!address) {
    address = await db.address.create({
      data: {
        campaignId: activeCampaignId,
        streetNumber: newData.streetNumber.trim(),
        streetName: newData.streetName.trim(),
        unitNumber: newData.unitNumber?.trim() || null,
        city: newData.city.trim(),
        province: newData.province.trim(),
        postalCode: normalizedPostal,
      },
    });
  }

  // Find or create a household at this address
  let household = await db.household.findFirst({
    where: { campaignId: activeCampaignId, addressId: address.id, deletedAt: null },
  });
  if (!household) {
    household = await db.household.create({
      data: { campaignId: activeCampaignId, addressId: address.id },
    });
  }

  // Move affected people to the new household
  await db.person.updateMany({
    where: { id: { in: request.affectedPersonIds }, campaignId: activeCampaignId },
    data: { householdId: household.id },
  });

  // Soft-delete the old household if it is now empty
  if (request.oldAddressId) {
    const oldHousehold = await db.household.findFirst({
      where: {
        addressId: request.oldAddressId,
        campaignId: activeCampaignId,
        deletedAt: null,
      },
    });
    if (oldHousehold) {
      const remaining = await db.person.count({
        where: { householdId: oldHousehold.id, deletedAt: null },
      });
      if (remaining === 0) {
        await db.household.update({
          where: { id: oldHousehold.id },
          data: { deletedAt: new Date() },
        });
      }
    }
  }

  // Mark approved
  await db.addressChangeRequest.update({
    where: { id: requestId },
    data: {
      status: "approved",
      reviewedByUserId: session.user.id,
      reviewedAt: new Date(),
    },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "ADDRESS_CHANGE_APPROVED",
    entityType: "address_change_request",
    entityId: requestId,
    details: { affectedPersonIds: request.affectedPersonIds, newAddressId: address.id },
  });

  return { success: true };
}

// ── Reject ─────────────────────────────────────────────────────────────────────

export async function rejectAddressChangeRequest(
  requestId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { success: false, error: "Unauthorized" };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { success: false, error: "No active campaign" };
  if (!activeRole || !canReviewAddressChanges(activeRole as Role)) {
    return { success: false, error: "Forbidden" };
  }

  const request = await db.addressChangeRequest.findFirst({
    where: { id: requestId, campaignId: activeCampaignId, status: "pending", deletedAt: null },
  });
  if (!request) return { success: false, error: "Request not found or already reviewed" };

  await db.addressChangeRequest.update({
    where: { id: requestId },
    data: {
      status: "rejected",
      reviewedByUserId: session.user.id,
      reviewedAt: new Date(),
    },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "ADDRESS_CHANGE_REJECTED",
    entityType: "address_change_request",
    entityId: requestId,
    details: { reason: reason ?? null },
  });

  return { success: true };
}
