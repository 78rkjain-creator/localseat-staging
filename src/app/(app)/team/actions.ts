"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role, ListSource } from "@prisma/client";
import { canManageTeam, canAssignCampaignManager } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { canAddRole } from "@/lib/plan-limits";
import { sendWelcomeEmail, sendVerificationEmail } from "@/lib/email";
import { generateVerificationToken } from "@/lib/verification";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Role as AppRole } from "@/types";

const FIELD_ORGANIZER_VISIBLE_ROLES: Role[] = [Role.canvasser, Role.sign_installer, Role.volunteer_coordinator];
const FIELD_ORG_ADDABLE_ROLES: Role[] = [Role.canvasser, Role.sign_installer];

async function requireTeamAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  return { session, campaignId: activeCampaignId, activeRole } as const;
}

// ── Return types ──────────────────────────────────────────────────────────────

export interface TeamMemberData {
  membershipId: string;
  role: Role;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneHome: string | null;
    phoneMobile: string | null;
    isActive: boolean;
    createdAt: string;
  };
}

export interface RemovedMemberData {
  membershipId: string;
  role: Role;
  removedAt: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
}

export interface AddMemberInput {
  email: string;
  firstName: string;
  lastName: string;
  phoneHome?: string | null;
  phoneMobile?: string | null;
  role: string;
  skipVerification?: boolean;
}

// ── getTeamMembers ────────────────────────────────────────────────────────────

export async function getTeamMembers(): Promise<{ error?: string; members?: TeamMemberData[] }> {
  const auth = await requireTeamAccess();
  if ("error" in auth) return { error: auth.error };
  const { campaignId, activeRole } = auth;

  const role = activeRole as Role | undefined;
  const isFullAccess = role === Role.candidate || role === Role.campaign_manager;
  const isFieldOrganizer = role === Role.field_organizer;

  if (!isFullAccess && !isFieldOrganizer) {
    return { error: "Forbidden." };
  }

  try {
    const members = await db.campaignMembership.findMany({
      where: {
        campaignId,
        deletedAt: null,
        ...(isFieldOrganizer && { role: { in: FIELD_ORGANIZER_VISIBLE_ROLES } }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneHome: true,
            phoneMobile: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      members: members.map((m) => ({
        membershipId: m.id,
        role: m.role,
        joinedAt: m.createdAt.toISOString(),
        user: {
          ...m.user,
          createdAt: m.user.createdAt.toISOString(),
        },
      })),
    };
  } catch {
    return { error: "Failed to load team members." };
  }
}

// ── getRemovedMembers ─────────────────────────────────────────────────────────

export async function getRemovedMembers(): Promise<{ error?: string; members?: RemovedMemberData[] }> {
  const auth = await requireTeamAccess();
  if ("error" in auth) return { error: auth.error };
  const { campaignId, activeRole } = auth;

  if (!activeRole || !canManageTeam(activeRole as AppRole)) {
    return { error: "Forbidden." };
  }

  try {
    const removed = await db.campaignMembership.findMany({
      where: {
        campaignId,
        deletedAt: { not: null },
        role: { not: Role.candidate },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
          },
        },
      },
      orderBy: { deletedAt: "desc" },
    });

    return {
      members: removed.map((m) => ({
        membershipId: m.id,
        role: m.role,
        removedAt: m.deletedAt?.toISOString() ?? null,
        user: m.user,
      })),
    };
  } catch {
    return { error: "Failed to load removed members." };
  }
}

// ── addTeamMember ─────────────────────────────────────────────────────────────

export async function addTeamMember(input: AddMemberInput): Promise<{
  error?: string;
  membershipId?: string;
  role?: Role;
  joinedAt?: string;
  user?: TeamMemberData["user"];
  personId?: string;
}> {
  const auth = await requireTeamAccess();
  if ("error" in auth) return { error: auth.error };
  const { session, campaignId, activeRole } = auth;

  const isFieldOrg = activeRole === Role.field_organizer;
  if (!activeRole || (!canManageTeam(activeRole as AppRole) && !isFieldOrg)) {
    return { error: "Forbidden." };
  }

  const { email, firstName, lastName, phoneHome, phoneMobile, role: roleInput, skipVerification = false } = input;

  if (!email || !firstName || !lastName || !roleInput) {
    return { error: "email, firstName, lastName, and role are required." };
  }

  if (!Object.values(Role).includes(roleInput as Role)) {
    return { error: `Invalid role: ${roleInput}` };
  }
  const role = roleInput as Role;

  if (role === Role.campaign_manager && !canAssignCampaignManager(activeRole as AppRole)) {
    return { error: "Only the candidate may assign the campaign_manager role." };
  }

  if (isFieldOrg && !FIELD_ORG_ADDABLE_ROLES.includes(role)) {
    return { error: "Field organizers can only add canvasser or sign installer members." };
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    let user = await db.user.findUnique({ where: { email: normalizedEmail } });
    const isNewUser = !user;

    let tempPassword: string | undefined;
    if (!user) {
      tempPassword = crypto.randomBytes(12).toString("base64url");
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const normalizedPhone = phoneHome?.trim() || null;
      const normalizedPhoneMobile = phoneMobile?.trim() || null;
      user = await db.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          ...(normalizedPhone !== null && { phoneHome: normalizedPhone }),
          ...(normalizedPhoneMobile !== null && { phoneMobile: normalizedPhoneMobile }),
          ...(skipVerification && { emailVerified: new Date() }),
        },
      });
    }

    const existing = await db.campaignMembership.findFirst({
      where: { userId: user.id, campaignId, deletedAt: null },
    });
    if (existing) {
      return { error: "This user is already a member of the campaign." };
    }

    const currentRoleCount = await db.campaignMembership.count({
      where: { campaignId, role, deletedAt: null },
    });
    const roleAllowed = await canAddRole(campaignId, role, currentRoleCount);
    if (!roleAllowed) {
      const roleLabel = role.replace(/_/g, " ");
      return { error: `Your current plan does not support additional ${roleLabel} accounts. Upgrade to add more team members.` };
    }

    const membership = await db.campaignMembership.create({
      data: { userId: user.id, campaignId, role },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneHome: true,
            phoneMobile: true,
            isActive: true,
            createdAt: true,
          },
        },
        campaign: { select: { name: true } },
      },
    });

    if (isNewUser) {
      if (skipVerification) {
        void sendWelcomeEmail({
          name: `${membership.user.firstName} ${membership.user.lastName}`,
          email: membership.user.email,
          campaignName: membership.campaign.name,
          role: membership.role,
          tempPassword,
        });
      } else {
        const verificationToken = await generateVerificationToken(user.id);
        void sendVerificationEmail({
          name: `${membership.user.firstName} ${membership.user.lastName}`,
          email: membership.user.email,
          token: verificationToken,
        });
      }
    }

    await createAuditLog({
      campaignId,
      userId: session.user.id,
      action: "MEMBER_ADDED",
      entityType: "campaign_membership",
      entityId: membership.id,
      details: { targetUserId: user.id, email: normalizedEmail, role },
    });

    // Create or update the Person record linked to this user.
    // Cannot use upsert — the userId+campaignId unique index is partial (WHERE userId IS NOT NULL).
    const existingPerson = await db.person.findFirst({
      where: { userId: user.id, campaignId },
      select: { id: true },
    });

    let person: { id: string };
    if (existingPerson) {
      person = await db.person.update({
        where: { id: existingPerson.id },
        data: { listSource: ListSource.team, needsDistrictClassification: true, deletedAt: null },
        select: { id: true },
      });
    } else {
      person = await db.person.create({
        data: {
          campaignId,
          userId: user.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          listSource: ListSource.team,
          needsDistrictClassification: true,
          includeInWalkLists: false,
        },
        select: { id: true },
      });
    }

    return {
      membershipId: membership.id,
      role: membership.role,
      joinedAt: membership.createdAt.toISOString(),
      user: { ...membership.user, createdAt: membership.user.createdAt.toISOString() },
      personId: person.id,
    };
  } catch {
    return { error: "Failed to add team member." };
  }
}

// ── removeTeamMember ──────────────────────────────────────────────────────────

export async function removeTeamMember(userId: string): Promise<{ error?: string }> {
  const auth = await requireTeamAccess();
  if ("error" in auth) return { error: auth.error };
  const { session, campaignId, activeRole } = auth;

  if (!activeRole || !canManageTeam(activeRole as AppRole)) {
    return { error: "Forbidden." };
  }

  const callerId = session.user.id;
  if (userId === callerId) {
    return { error: "You cannot remove yourself from the campaign." };
  }

  try {
    const membership = await db.campaignMembership.findFirst({
      where: { userId, campaignId, deletedAt: null },
    });
    if (!membership) return { error: "Member not found." };

    if (membership.role === Role.candidate) {
      return { error: "The candidate cannot be removed from the campaign." };
    }

    await db.campaignMembership.update({
      where: { userId_campaignId: { userId, campaignId } },
      data: { deletedAt: new Date() },
    });

    await db.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });

    await createAuditLog({
      campaignId,
      userId: callerId,
      action: "MEMBER_REMOVED",
      entityType: "campaign_membership",
      entityId: membership.id,
      details: { targetUserId: userId, role: membership.role },
    });

    return {};
  } catch {
    return { error: "Failed to remove team member." };
  }
}

// ── restoreTeamMember ─────────────────────────────────────────────────────────

export async function restoreTeamMember(userId: string): Promise<{ error?: string }> {
  const auth = await requireTeamAccess();
  if ("error" in auth) return { error: auth.error };
  const { session, campaignId, activeRole } = auth;

  if (!activeRole || !canManageTeam(activeRole as AppRole)) {
    return { error: "Forbidden." };
  }

  try {
    const membership = await db.campaignMembership.findFirst({
      where: { userId, campaignId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
      include: { user: { select: { email: true } } },
    });
    if (!membership) return { error: "No removed membership found for this user." };

    const active = await db.campaignMembership.findFirst({
      where: { userId, campaignId, deletedAt: null },
    });
    if (active) return { error: "This user already has an active membership." };

    const restored = await db.campaignMembership.update({
      where: { id: membership.id },
      data: { deletedAt: null },
    });

    await db.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });

    await createAuditLog({
      campaignId,
      userId: session.user.id,
      action: "MEMBER_ADDED",
      entityType: "campaign_membership",
      entityId: restored.id,
      details: { targetUserId: userId, email: membership.user.email, role: restored.role, restored: true },
    });

    return {};
  } catch {
    return { error: "Failed to restore team member." };
  }
}
