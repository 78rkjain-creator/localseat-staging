"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role, ListSource } from "@prisma/client";
import { canManageVolunteers } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import type { Role as AppRole } from "@/types";

const WORKING_ROLES: Role[] = [Role.canvasser, Role.sign_installer];

async function requireVolunteerManageAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canManageVolunteers(activeRole as AppRole)) {
    return { error: "Forbidden." } as const;
  }
  return { session, campaignId: activeCampaignId } as const;
}

// ── addPureVolunteer ──────────────────────────────────────────────────────────
// Creates a Person with no User account and marks them as a volunteer.

export async function addPureVolunteer(input: {
  firstName: string;
  lastName: string;
  email?: string | null;
  phoneHome?: string | null;
  phoneMobile?: string | null;
}): Promise<{ error?: string; personId?: string }> {
  const auth = await requireVolunteerManageAccess();
  if ("error" in auth) return { error: auth.error };
  const { session, campaignId } = auth;

  const { firstName, lastName } = input;
  if (!firstName?.trim() || !lastName?.trim()) {
    return { error: "First name and last name are required." };
  }

  const normalizedEmail = input.email?.trim().toLowerCase() || null;

  try {
    if (normalizedEmail) {
      const existing = await db.person.findFirst({
        where: { campaignId, email: normalizedEmail, deletedAt: null },
        select: { id: true },
      });
      if (existing) return { error: "A person with this email already exists." };
    }

    const person = await db.person.create({
      data: {
        campaignId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phoneHome: input.phoneHome?.trim() || null,
        phoneMobile: input.phoneMobile?.trim() || null,
        listSource: ListSource.manual,
        includeInWalkLists: false,
      },
      select: { id: true },
    });

    await db.volunteerRecord.upsert({
      where: { campaignId_personId: { campaignId, personId: person.id } },
      create: { campaignId, personId: person.id, status: "interested" },
      update: { deletedAt: null, status: "interested" },
    });

    await createAuditLog({
      campaignId,
      userId: session.user.id,
      action: "PERSON_CREATED",
      entityType: "person",
      entityId: person.id,
      details: {
        source: "pure_volunteer",
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      },
    });

    return { personId: person.id };
  } catch {
    return { error: "Failed to add volunteer." };
  }
}

// ── removeVolunteerRecord ─────────────────────────────────────────────────────
// Soft-deletes the VolunteerRecord for a pure volunteer.
// The person contact record remains intact.

export async function removeVolunteerRecord(personId: string): Promise<{ error?: string }> {
  const auth = await requireVolunteerManageAccess();
  if ("error" in auth) return { error: auth.error };
  const { session, campaignId } = auth;

  try {
    const record = await db.volunteerRecord.findUnique({
      where: { campaignId_personId: { campaignId, personId } },
    });
    if (!record || record.deletedAt) {
      return { error: "Volunteer record not found." };
    }

    await db.volunteerRecord.update({
      where: { campaignId_personId: { campaignId, personId } },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      campaignId,
      userId: session.user.id,
      action: "PERSON_UPDATED",
      entityType: "person",
      entityId: personId,
      details: { changes: { volunteerInterest: { from: true, to: false } } },
    });

    return {};
  } catch {
    return { error: "Failed to remove volunteer record." };
  }
}

// ── removeVolunteerMembership ─────────────────────────────────────────────────
// Soft-deletes the canvasser or sign_installer membership for a working-tier member.
// Increments sessionVersion to revoke their active sessions.

export async function removeVolunteerMembership(userId: string): Promise<{ error?: string }> {
  const auth = await requireVolunteerManageAccess();
  if ("error" in auth) return { error: auth.error };
  const { session, campaignId } = auth;

  try {
    const membership = await db.campaignMembership.findFirst({
      where: {
        userId,
        campaignId,
        deletedAt: null,
        role: { in: WORKING_ROLES },
      },
    });
    if (!membership) {
      return { error: "No active canvasser or sign installer membership found." };
    }

    await db.campaignMembership.update({
      where: { id: membership.id },
      data: { deletedAt: new Date() },
    });

    await db.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });

    await createAuditLog({
      campaignId,
      userId: session.user.id,
      action: "MEMBER_REMOVED",
      entityType: "campaign_membership",
      entityId: membership.id,
      details: { targetUserId: userId, role: membership.role },
    });

    return {};
  } catch {
    return { error: "Failed to remove membership." };
  }
}
