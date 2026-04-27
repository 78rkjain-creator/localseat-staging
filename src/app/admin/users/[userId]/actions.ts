"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperUser, requirePlatformAdmin } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { Role } from "@prisma/client";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function deactivateUser(
  userId: string
): Promise<{ error?: string }> {
  const auth = await requirePlatformAdmin();
  if ("error" in auth) return auth;

  await db.user.update({
    where: { id: userId },
    data: { isActive: false },
  });

  await createAuditLog({
    userId: auth.session.user.id,
    action: "USER_DEACTIVATED",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return {};
}

export async function reactivateUser(
  userId: string
): Promise<{ error?: string }> {
  const auth = await requirePlatformAdmin();
  if ("error" in auth) return auth;

  await db.user.update({
    where: { id: userId },
    data: { isActive: true },
  });

  await createAuditLog({
    userId: auth.session.user.id,
    action: "USER_REACTIVATED",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return {};
}

export async function assignSuperAdmin(
  userId: string
): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  await db.user.update({
    where: { id: userId },
    data: { platformRole: "super_admin" },
  });

  await createAuditLog({
    userId: auth.session.user.id,
    action: "SUPER_ADMIN_ASSIGNED",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return {};
}

export async function revokePlatformRole(
  userId: string
): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  // Cannot revoke own role
  if (auth.session.user.id === userId) {
    return { error: "You cannot revoke your own platform role." };
  }

  await db.user.update({
    where: { id: userId },
    data: { platformRole: null },
  });

  await createAuditLog({
    userId: auth.session.user.id,
    action: "PLATFORM_ROLE_REVOKED",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return {};
}

export async function sendPasswordResetLink(
  userId: string
): Promise<{ error?: string; sent?: boolean }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!user) return { error: "User not found." };

  const token = generateToken();
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.user.update({
    where: { id: userId },
    data: { passwordResetToken: token, passwordResetTokenExpiry: expiry },
  });

  await createAuditLog({
    userId: auth.session.user.id,
    action: "PASSWORD_RESET_REQUESTED",
    entityType: "user",
    entityId: userId,
    details: { triggeredBy: "admin" },
  });

  void sendPasswordResetEmail({
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    token,
  });

  return { sent: true };
}

export async function hardDeleteUser(
  userId: string
): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  // Cannot hard-delete yourself
  if (auth.session.user.id === userId) {
    return { error: "You cannot delete your own account." };
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, email: true } });
  if (!user) return { error: "User not found." };

  // Get canvass assignment IDs so we can delete their responses first
  const assignments = await db.canvassAssignment.findMany({
    where: { canvasserId: userId },
    select: { id: true },
  });
  const assignmentIds = assignments.map((a) => a.id);

  await db.$transaction(async (tx) => {
    // Null out nullable FK references — retain the records, clear the user link
    await tx.auditLog.updateMany({ where: { userId }, data: { userId: null } });
    await tx.outreachLog.updateMany({ where: { userId }, data: { userId: null } });
    await tx.task.updateMany({ where: { assignedTo: userId }, data: { assignedTo: null } });
    await tx.donor.updateMany({ where: { createdById: userId }, data: { createdById: null } });
    await tx.addressChangeRequest.updateMany({ where: { reviewedByUserId: userId }, data: { reviewedByUserId: null } });

    // Delete records with non-nullable FK to user
    if (assignmentIds.length > 0) {
      await tx.canvassResponse.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
    }
    await tx.canvassAssignment.deleteMany({ where: { canvasserId: userId } });
    await tx.addressChangeRequest.deleteMany({ where: { requestedByUserId: userId } });
    await tx.canvassListEntry.deleteMany({ where: { addedById: userId } });
    await tx.note.deleteMany({ where: { authorId: userId } });
    await tx.campaignMembership.deleteMany({ where: { userId } });

    // Delete the user record itself
    await tx.user.delete({ where: { id: userId } });
  });

  // Audit log uses null userId since the user is gone — log against the admin
  await createAuditLog({
    userId: auth.session.user.id,
    action: "USER_HARD_DELETED",
    entityType: "user",
    entityId: userId,
    details: { deletedEmail: user.email, deletedName: `${user.firstName} ${user.lastName}` },
  });

  revalidatePath("/admin/users");
  return {};
}

// ── Campaign role management (super_user only) ────────────────────────────────

export async function adminChangeUserRoleFromUserPanel(
  membershipId: string,
  newRole: Role
): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  const membership = await db.campaignMembership.findFirst({
    where: { id: membershipId, deletedAt: null },
    select: { id: true, userId: true, role: true, campaignId: true },
  });
  if (!membership) return { error: "Membership not found." };

  if (membership.role === Role.candidate) {
    return { error: "Use the campaign panel to reassign the candidate role." };
  }

  if (newRole === Role.candidate) {
    const existingCandidate = await db.campaignMembership.findFirst({
      where: {
        campaignId: membership.campaignId,
        role: Role.candidate,
        deletedAt: null,
        id: { not: membershipId },
      },
      select: { id: true },
    });
    if (existingCandidate) {
      return { error: "Use transfer to assign the candidate role when one already exists." };
    }
  }

  const previousRole = membership.role;
  await db.campaignMembership.update({
    where: { id: membershipId },
    data: { role: newRole },
  });

  await createAuditLog({
    campaignId: membership.campaignId,
    userId: auth.session.user.id,
    action: "ROLE_CHANGED",
    entityType: "campaign_membership",
    entityId: membershipId,
    details: { targetUserId: membership.userId, previousRole, newRole, changedByAdmin: true },
  });

  revalidatePath(`/admin/users/${membership.userId}`);
  return {};
}

export async function adminTransferCandidateRoleFromUserPanel(
  currentCandidateMembershipId: string,
  newCandidateMembershipId: string,
  formerCandidateNewRole: Role
): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  if (formerCandidateNewRole === Role.candidate) {
    return { error: "The former candidate must be assigned a non-candidate role." };
  }
  if (currentCandidateMembershipId === newCandidateMembershipId) {
    return { error: "New candidate must be a different member." };
  }

  const [current, incoming] = await Promise.all([
    db.campaignMembership.findFirst({
      where: { id: currentCandidateMembershipId, deletedAt: null },
      select: { id: true, userId: true, role: true, campaignId: true },
    }),
    db.campaignMembership.findFirst({
      where: { id: newCandidateMembershipId, deletedAt: null },
      select: { id: true, userId: true, role: true, campaignId: true },
    }),
  ]);

  if (!current) return { error: "Current candidate membership not found." };
  if (!incoming) return { error: "Incoming candidate membership not found." };
  if (current.campaignId !== incoming.campaignId) {
    return { error: "Memberships must belong to the same campaign." };
  }

  const campaignId = incoming.campaignId;

  await db.$transaction([
    db.campaignMembership.update({
      where: { id: newCandidateMembershipId },
      data: { role: Role.candidate },
    }),
    db.campaignMembership.update({
      where: { id: currentCandidateMembershipId },
      data: { role: formerCandidateNewRole },
    }),
  ]);

  await Promise.all([
    createAuditLog({
      campaignId,
      userId: auth.session.user.id,
      action: "CANDIDATE_ROLE_TRANSFERRED",
      entityType: "campaign_membership",
      entityId: newCandidateMembershipId,
      details: {
        targetUserId: incoming.userId,
        previousRole: incoming.role,
        newRole: Role.candidate,
        changedByAdmin: true,
      },
    }),
    createAuditLog({
      campaignId,
      userId: auth.session.user.id,
      action: "CANDIDATE_ROLE_RELINQUISHED",
      entityType: "campaign_membership",
      entityId: currentCandidateMembershipId,
      details: {
        targetUserId: current.userId,
        previousRole: current.role,
        newRole: formerCandidateNewRole,
        changedByAdmin: true,
      },
    }),
  ]);

  revalidatePath(`/admin/users/${incoming.userId}`);
  return {};
}
