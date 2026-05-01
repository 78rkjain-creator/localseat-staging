"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { isSuperUser } from "@/lib/permissions";

// ── Types ──────────────────────────────────────────────────────────────────

export type SupportAccessStatus =
  | "none"
  | "pending"
  | "active"
  | "expired"
  | "denied"
  | "revoked";

export interface SupportAccessStatusResult {
  status: SupportAccessStatus;
  expiresAt: Date | null;
  requestedByName: string | null;
  approvedByName: string | null;
  grantId: string | null;
  requestNote: string | null;
  requestedAt: Date | null;
}

// ── Read helpers ───────────────────────────────────────────────────────────

export async function hasActiveFullAccess(campaignId: string): Promise<boolean> {
  const now = new Date();
  const grant = await db.supportAccessGrant.findFirst({
    where: {
      campaignId,
      approvedAt: { not: null },
      expiresAt: { gt: now },
      revokedAt: null,
      deniedAt: null,
    },
    select: { id: true },
  });
  return grant !== null;
}

export async function hasPendingRequest(campaignId: string): Promise<{
  pending: boolean;
  requestedBy?: string;
  requestedAt?: Date;
  requestNote?: string | null;
  grantId?: string;
}> {
  const grant = await db.supportAccessGrant.findFirst({
    where: {
      campaignId,
      approvedAt: null,
      deniedAt: null,
    },
    include: {
      requestedByUser: { select: { firstName: true, lastName: true } },
    },
    orderBy: { requestedAt: "desc" },
  });

  if (!grant) return { pending: false };

  return {
    pending: true,
    requestedBy: `${grant.requestedByUser.firstName} ${grant.requestedByUser.lastName}`,
    requestedAt: grant.requestedAt,
    requestNote: grant.requestNote,
    grantId: grant.id,
  };
}

export async function getSupportAccessStatus(
  campaignId: string
): Promise<SupportAccessStatusResult> {
  const now = new Date();

  const grant = await db.supportAccessGrant.findFirst({
    where: { campaignId },
    include: {
      requestedByUser: { select: { firstName: true, lastName: true } },
      approvedByUser:  { select: { firstName: true, lastName: true } },
    },
    orderBy: { requestedAt: "desc" },
  });

  if (!grant) {
    return { status: "none", expiresAt: null, requestedByName: null, approvedByName: null, grantId: null, requestNote: null, requestedAt: null };
  }

  const requestedByName = `${grant.requestedByUser.firstName} ${grant.requestedByUser.lastName}`;
  const approvedByName = grant.approvedByUser
    ? `${grant.approvedByUser.firstName} ${grant.approvedByUser.lastName}`
    : null;

  let status: SupportAccessStatus;

  if (grant.deniedAt) {
    status = "denied";
  } else if (grant.revokedAt) {
    status = "revoked";
  } else if (grant.approvedAt && grant.expiresAt && grant.expiresAt <= now) {
    status = "expired";
  } else if (grant.approvedAt && grant.expiresAt && grant.expiresAt > now) {
    status = "active";
  } else {
    status = "pending";
  }

  return {
    status,
    expiresAt: grant.expiresAt,
    requestedByName,
    approvedByName,
    grantId: grant.id,
    requestNote: grant.requestNote,
    requestedAt: grant.requestedAt,
  };
}

// ── Write actions ──────────────────────────────────────────────────────────

export async function requestSupportAccess(
  campaignId: string,
  requestedByUserId: string,
  note?: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };
  if (!isSuperUser(session.user.platformRole)) {
    return { error: "Only support team members can request support access." };
  }

  // Check for existing pending request
  const existing = await db.supportAccessGrant.findFirst({
    where: { campaignId, approvedAt: null, deniedAt: null },
    select: { id: true },
  });
  if (existing) {
    return { error: "A support access request is already pending for this campaign." };
  }

  const grant = await db.supportAccessGrant.create({
    data: {
      campaignId,
      requestedBy: requestedByUserId,
      requestNote: note?.trim() || null,
    },
  });

  await createAuditLog({
    campaignId,
    userId: requestedByUserId,
    action: "SUPPORT_ACCESS_REQUESTED",
    entityType: "support_access_grant",
    entityId: grant.id,
    details: { note: note?.trim() || null },
  });

  // Email all candidate/campaign_manager members
  try {
    const { sendSupportAccessRequestEmail } = await import("@/lib/email");
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { name: true },
    });
    const requester = await db.user.findUnique({
      where: { id: requestedByUserId },
      select: { firstName: true, lastName: true },
    });
    const recipients = await db.campaignMembership.findMany({
      where: {
        campaignId,
        role: { in: ["candidate", "campaign_manager"] },
        deletedAt: null,
      },
      include: { user: { select: { email: true } } },
    });

    if (campaign && requester) {
      const requesterName = `${requester.firstName} ${requester.lastName}`;
      for (const m of recipients) {
        await sendSupportAccessRequestEmail({
          recipientEmail: m.user.email,
          campaignName: campaign.name,
          requesterName,
          note: note?.trim() || null,
        });
      }
    }
  } catch (err) {
    console.error("[support-access] Failed to send notification emails:", err);
  }

  return {};
}

export async function approveSupportAccess(
  grantId: string,
  approvedByUserId: string
): Promise<{ error?: string }> {
  const grant = await db.supportAccessGrant.findUnique({
    where: { id: grantId },
    select: { id: true, campaignId: true, approvedAt: true, deniedAt: true },
  });
  if (!grant) return { error: "Grant not found." };
  if (grant.approvedAt) return { error: "This request has already been approved." };
  if (grant.deniedAt) return { error: "This request has already been denied." };

  const membership = await db.campaignMembership.findFirst({
    where: {
      campaignId: grant.campaignId,
      userId: approvedByUserId,
      role: { in: ["candidate", "campaign_manager"] },
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!membership) {
    return { error: "Only a candidate or campaign manager can approve support access." };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  await db.supportAccessGrant.update({
    where: { id: grantId },
    data: { approvedBy: approvedByUserId, approvedAt: now, expiresAt },
  });

  await createAuditLog({
    campaignId: grant.campaignId,
    userId: approvedByUserId,
    action: "SUPPORT_ACCESS_APPROVED",
    entityType: "support_access_grant",
    entityId: grantId,
    details: { expiresAt },
  });

  return {};
}

export async function denySupportAccess(
  grantId: string,
  deniedByUserId: string
): Promise<{ error?: string }> {
  const grant = await db.supportAccessGrant.findUnique({
    where: { id: grantId },
    select: { id: true, campaignId: true, approvedAt: true, deniedAt: true },
  });
  if (!grant) return { error: "Grant not found." };
  if (grant.deniedAt) return { error: "This request has already been denied." };

  const membership = await db.campaignMembership.findFirst({
    where: {
      campaignId: grant.campaignId,
      userId: deniedByUserId,
      role: { in: ["candidate", "campaign_manager"] },
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!membership) {
    return { error: "Only a candidate or campaign manager can deny support access." };
  }

  await db.supportAccessGrant.update({
    where: { id: grantId },
    data: { deniedAt: new Date(), deniedBy: deniedByUserId },
  });

  await createAuditLog({
    campaignId: grant.campaignId,
    userId: deniedByUserId,
    action: "SUPPORT_ACCESS_DENIED",
    entityType: "support_access_grant",
    entityId: grantId,
  });

  return {};
}

export async function revokeSupportAccess(
  campaignId: string,
  revokedByUserId: string
): Promise<{ error?: string }> {
  const now = new Date();
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  // Must be candidate/campaign_manager of the campaign OR a super_user
  const isSU = isSuperUser(session.user.platformRole);
  if (!isSU) {
    const membership = await db.campaignMembership.findFirst({
      where: {
        campaignId,
        userId: revokedByUserId,
        role: { in: ["candidate", "campaign_manager"] },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!membership) {
      return { error: "You don't have permission to revoke support access." };
    }
  }

  const grant = await db.supportAccessGrant.findFirst({
    where: {
      campaignId,
      approvedAt: { not: null },
      expiresAt: { gt: now },
      revokedAt: null,
      deniedAt: null,
    },
    select: { id: true },
  });

  if (!grant) {
    return { error: "No active support access grant found." };
  }

  await db.supportAccessGrant.update({
    where: { id: grant.id },
    data: { revokedAt: now, revokedBy: revokedByUserId },
  });

  await createAuditLog({
    campaignId,
    userId: revokedByUserId,
    action: "SUPPORT_ACCESS_REVOKED",
    entityType: "support_access_grant",
    entityId: grant.id,
  });

  return {};
}

export async function cancelSupportAccessRequest(
  campaignId: string,
  cancelledByUserId: string
): Promise<{ error?: string }> {
  const pending = await db.supportAccessGrant.findFirst({
    where: { campaignId, approvedAt: null, deniedAt: null },
    select: { id: true },
  });
  if (!pending) return { error: "No pending request found." };

  await db.supportAccessGrant.update({
    where: { id: pending.id },
    data: { deniedAt: new Date(), deniedBy: cancelledByUserId },
  });

  await createAuditLog({
    campaignId,
    userId: cancelledByUserId,
    action: "SUPPORT_ACCESS_CANCELLED",
    entityType: "support_access_grant",
    entityId: pending.id,
  });

  return {};
}

// ── Write guard ────────────────────────────────────────────────────────────
// Call this at the top of every write server action to block readonly support sessions.

export async function checkSupportWriteAccess(): Promise<{
  allowed: boolean;
  error?: string;
}> {
  const session = await getServerSession(authOptions);
  if (!session) return { allowed: true }; // not a support session; auth handled elsewhere
  if (session.user.supportMode === "readonly") {
    return {
      allowed: false,
      error: "Read-only support mode — editing is not permitted.",
    };
  }
  return { allowed: true };
}
