"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import {
  canManageRoles,
  canManageRolesExceptCandidate,
  isSuperUser,
} from "@/lib/permissions";

// ── changeUserRole ────────────────────────────────────────────────────────────

export async function changeUserRole(
  membershipId: string,
  newRole: Role
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  const platformRole = session.user.platformRole ?? null;

  if (!activeCampaignId) return { error: "No active campaign." };

  const isFieldOrg = activeRole === Role.field_organizer;
  const callerCanManage =
    canManageRolesExceptCandidate(activeRole as Role) ||
    isSuperUser(platformRole) ||
    isFieldOrg;
  if (!callerCanManage) return { error: "Insufficient permissions." };

  // campaign_manager cannot assign the candidate role — only candidate/super_user can
  const callerCanAssignCandidate =
    canManageRoles(activeRole as Role) || isSuperUser(platformRole);
  if (newRole === Role.candidate && !callerCanAssignCandidate) {
    return { error: "Only the candidate may assign the candidate role." };
  }

  // field_organizer can only assign canvasser or sign_installer
  const FIELD_ORG_ALLOWED_ROLES: Role[] = [Role.canvasser, Role.sign_installer];
  if (isFieldOrg && !FIELD_ORG_ALLOWED_ROLES.includes(newRole)) {
    return { error: "Field organizers can only assign canvasser or sign installer roles." };
  }

  // Verify the target membership belongs to the caller's campaign
  const membership = await db.campaignMembership.findFirst({
    where: { id: membershipId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true, userId: true, role: true, campaignId: true },
  });
  if (!membership) return { error: "Membership not found." };

  // Prevent changing your own role
  if (membership.userId === session.user.id) {
    return { error: "You cannot change your own role." };
  }

  // field_organizer can only act on canvasser or sign_installer rows
  if (isFieldOrg && !FIELD_ORG_ALLOWED_ROLES.includes(membership.role)) {
    return { error: "Field organizers can only change canvasser or sign installer roles." };
  }

  const previousRole = membership.role;

  await db.campaignMembership.update({
    where: { id: membershipId },
    data: { role: newRole },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "ROLE_CHANGED",
    entityType: "campaign_membership",
    entityId: membershipId,
    details: {
      targetUserId: membership.userId,
      previousRole,
      newRole,
    },
  });

  return {};
}

// ── transferCandidateRole ─────────────────────────────────────────────────────

export async function transferCandidateRole(
  currentCandidateMembershipId: string,
  newCandidateMembershipId: string,
  formerCandidateNewRole: Role
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  const platformRole = session.user.platformRole ?? null;

  if (!activeCampaignId) return { error: "No active campaign." };

  const callerCanTransfer =
    canManageRoles(activeRole as Role) || isSuperUser(platformRole);
  if (!callerCanTransfer) {
    return { error: "Only the candidate may transfer the candidate role." };
  }

  if (formerCandidateNewRole === Role.candidate) {
    return { error: "The former candidate must be assigned a non-candidate role." };
  }

  if (currentCandidateMembershipId === newCandidateMembershipId) {
    return { error: "New candidate must be a different member." };
  }

  // Verify both memberships belong to the caller's campaign
  const [current, incoming] = await Promise.all([
    db.campaignMembership.findFirst({
      where: { id: currentCandidateMembershipId, campaignId: activeCampaignId, deletedAt: null },
      select: { id: true, userId: true, role: true },
    }),
    db.campaignMembership.findFirst({
      where: { id: newCandidateMembershipId, campaignId: activeCampaignId, deletedAt: null },
      select: { id: true, userId: true, role: true },
    }),
  ]);

  if (!current) return { error: "Current candidate membership not found." };
  if (!incoming) return { error: "Incoming candidate membership not found." };

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
      campaignId: activeCampaignId,
      userId: session.user.id,
      action: "CANDIDATE_ROLE_TRANSFERRED",
      entityType: "campaign_membership",
      entityId: newCandidateMembershipId,
      details: {
        targetUserId: incoming.userId,
        previousRole: incoming.role,
        newRole: Role.candidate,
      },
    }),
    createAuditLog({
      campaignId: activeCampaignId,
      userId: session.user.id,
      action: "CANDIDATE_ROLE_RELINQUISHED",
      entityType: "campaign_membership",
      entityId: currentCandidateMembershipId,
      details: {
        targetUserId: current.userId,
        previousRole: current.role,
        newRole: formerCandidateNewRole,
      },
    }),
  ]);

  return {};
}
