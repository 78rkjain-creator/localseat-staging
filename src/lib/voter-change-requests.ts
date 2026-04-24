"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { canReviewAddressChanges } from "@/lib/permissions";
import type { Role } from "@/types";

export interface NewResidentData {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  streetNumber: string;
  streetName: string;
  unitNumber?: string;
  city: string;
  postalCode: string;
}

export interface VoterChangeFields {
  firstName?: string;
  lastName?: string;
  phoneHome?: string | null;
  phoneMobile?: string | null;
  email?: string | null;
  birthYear?: number | null;
}

// ── Submit ─────────────────────────────────────────────────────────────────────

export async function submitVoterChangeRequest(params: {
  personId: string;
  campaignId: string;
  proposedChanges: VoterChangeFields;
  currentSnapshot: VoterChangeFields;
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

  if (Object.keys(params.proposedChanges).length === 0) {
    return { success: false, error: "No changes to submit" };
  }

  const request = await db.voterChangeRequest.create({
    data: {
      campaignId: params.campaignId,
      submittedByUserId: session.user.id,
      personId: params.personId,
      proposedChanges: params.proposedChanges as never,
      currentSnapshot: params.currentSnapshot as never,
    },
  });

  await createAuditLog({
    campaignId: params.campaignId,
    userId: session.user.id,
    action: "VOTER_CHANGE_REQUESTED",
    entityType: "voter_change_request",
    entityId: request.id,
    details: { proposedChanges: params.proposedChanges },
  });

  return { success: true };
}

// ── Pending count (for sidebar badge) ─────────────────────────────────────────

export async function getPendingVoterChangeCount(campaignId: string): Promise<number> {
  return db.voterChangeRequest.count({
    where: { campaignId, status: "pending", deletedAt: null },
  });
}

// ── List pending requests ──────────────────────────────────────────────────────

export async function getPendingVoterChangeRequests(campaignId: string) {
  return db.voterChangeRequest.findMany({
    where: { campaignId, status: "pending", deletedAt: null },
    include: {
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneHome: true,
          phoneMobile: true,
          email: true,
          birthYear: true,
        },
      },
      submittedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

// ── Approve ────────────────────────────────────────────────────────────────────

export async function approveVoterChangeRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { success: false, error: "Unauthorized" };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { success: false, error: "No active campaign" };
  if (!activeRole || !canReviewAddressChanges(activeRole as Role)) {
    return { success: false, error: "Forbidden" };
  }

  const request = await db.voterChangeRequest.findFirst({
    where: { id: requestId, campaignId: activeCampaignId, status: "pending", deletedAt: null },
  });
  if (!request) return { success: false, error: "Request not found or already reviewed" };

  const changes = request.proposedChanges as VoterChangeFields;

  // Apply changes to person record
  await db.person.update({
    where: { id: request.personId! },
    data: {
      ...(changes.firstName !== undefined && { firstName: changes.firstName }),
      ...(changes.lastName !== undefined && { lastName: changes.lastName }),
      ...(changes.phoneHome !== undefined && { phoneHome: changes.phoneHome }),
      ...(changes.phoneMobile !== undefined && { phoneMobile: changes.phoneMobile }),
      ...(changes.email !== undefined && { email: changes.email }),
      ...(changes.birthYear !== undefined && { birthYear: changes.birthYear }),
    },
  });

  await db.voterChangeRequest.update({
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
    action: "VOTER_CHANGE_APPROVED",
    entityType: "voter_change_request",
    entityId: requestId,
    details: { proposedChanges: changes, personId: request.personId },
  });

  return { success: true };
}

// ── Reject ─────────────────────────────────────────────────────────────────────

export async function rejectVoterChangeRequest(
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

  const request = await db.voterChangeRequest.findFirst({
    where: { id: requestId, campaignId: activeCampaignId, status: "pending", deletedAt: null },
  });
  if (!request) return { success: false, error: "Request not found or already reviewed" };

  await db.voterChangeRequest.update({
    where: { id: requestId },
    data: {
      status: "rejected",
      reviewedByUserId: session.user.id,
      reviewedAt: new Date(),
      rejectionReason: reason ?? null,
    },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "VOTER_CHANGE_REJECTED",
    entityType: "voter_change_request",
    entityId: requestId,
    details: { reason: reason ?? null },
  });

  return { success: true };
}

// ── Submit new resident ────────────────────────────────────────────────────────

export async function submitNewResidentRequest(params: {
  campaignId: string;
  residentData: NewResidentData;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { success: false, error: "Unauthorized" };

  const { activeCampaignId } = session.user;
  if (!activeCampaignId || activeCampaignId !== params.campaignId) {
    return { success: false, error: "No active campaign" };
  }

  const request = await (db.voterChangeRequest as unknown as {
    create: (a: unknown) => Promise<{ id: string }>;
  }).create({
    data: {
      campaignId: params.campaignId,
      submittedByUserId: session.user.id,
      requestType: "new_resident",
      proposedChanges: params.residentData as never,
      currentSnapshot: {},
    },
  });

  await createAuditLog({
    campaignId: params.campaignId,
    userId: session.user.id,
    action: "NEW_RESIDENT_REQUESTED",
    entityType: "voter_change_request",
    entityId: request.id,
    details: { residentData: params.residentData },
  });

  return { success: true };
}

// ── Approve new resident ───────────────────────────────────────────────────────

export async function approveNewResidentRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { success: false, error: "Unauthorized" };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { success: false, error: "No active campaign" };
  if (!activeRole || !canReviewAddressChanges(activeRole as Role)) {
    return { success: false, error: "Forbidden" };
  }

  const request = await (db.voterChangeRequest as unknown as {
    findFirst: (a: unknown) => Promise<{ id: string; proposedChanges: unknown } | null>;
  }).findFirst({
    where: { id: requestId, campaignId: activeCampaignId, status: "pending", deletedAt: null },
  });
  if (!request) return { success: false, error: "Request not found or already reviewed" };

  const data = request.proposedChanges as NewResidentData;
  const normalizedPostal = data.postalCode.trim().toUpperCase().replace(/\s/g, "");

  // Find or create Address
  let address = await db.address.findFirst({
    where: {
      campaignId: activeCampaignId,
      streetNumber: data.streetNumber.trim(),
      streetName: { equals: data.streetName.trim(), mode: "insensitive" },
      unitNumber: data.unitNumber?.trim() || null,
      city: { equals: data.city.trim(), mode: "insensitive" },
      postalCode: normalizedPostal,
      deletedAt: null,
    },
  });
  if (!address) {
    address = await db.address.create({
      data: {
        campaignId: activeCampaignId,
        streetNumber: data.streetNumber.trim(),
        streetName: data.streetName.trim(),
        unitNumber: data.unitNumber?.trim() || null,
        city: data.city.trim(),
        province: "ON",
        postalCode: normalizedPostal,
      },
    });
  }

  // Find or create Household at this address
  let household = await db.household.findFirst({
    where: { campaignId: activeCampaignId, addressId: address.id, deletedAt: null },
  });
  if (!household) {
    household = await db.household.create({
      data: { campaignId: activeCampaignId, addressId: address.id },
    });
  }

  // Create Person
  const person = await db.person.create({
    data: {
      campaignId: activeCampaignId,
      householdId: household.id,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phoneHome: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      importSource: "canvass_door",
    },
  });

  // Mark approved and link the created person
  await db.voterChangeRequest.update({
    where: { id: requestId },
    data: {
      status: "approved",
      reviewedByUserId: session.user.id,
      reviewedAt: new Date(),
      personId: person.id,
    } as never,
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "NEW_RESIDENT_APPROVED",
    entityType: "voter_change_request",
    entityId: requestId,
    details: { newPersonId: person.id, address: data },
  });

  return { success: true };
}
