"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireSuperUser, requirePlatformAdmin, isSuperUser, isSuperAdmin } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { getEffectiveLimits } from "@/lib/plan-limits";
import {
  requestSupportAccess,
  cancelSupportAccessRequest,
  revokeSupportAccess,
  hasActiveFullAccess,
  getSupportAccessStatus,
} from "@/lib/support-access";
import type { CampaignOverride } from "@prisma/client";
import { Role } from "@prisma/client";
import type { SupportAccessStatusResult } from "@/lib/support-access";

// ── Actions ───────────────────────────────────────────────────────────────────

export async function deactivateCampaign(
  campaignId: string
): Promise<{ error?: string }> {
  const auth = await requirePlatformAdmin();
  if ("error" in auth) return auth;

  await db.campaign.update({
    where: { id: campaignId },
    data: { isActive: false },
  });

  await createAuditLog({
    campaignId,
    userId: auth.session.user.id,
    action: "CAMPAIGN_DEACTIVATED",
    entityType: "campaign",
    entityId: campaignId,
  });

  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath("/admin/campaigns");
  return {};
}

export async function reactivateCampaign(
  campaignId: string
): Promise<{ error?: string }> {
  const auth = await requirePlatformAdmin();
  if ("error" in auth) return auth;

  await db.campaign.update({
    where: { id: campaignId },
    data: { isActive: true },
  });

  await createAuditLog({
    campaignId,
    userId: auth.session.user.id,
    action: "CAMPAIGN_REACTIVATED",
    entityType: "campaign",
    entityId: campaignId,
  });

  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath("/admin/campaigns");
  return {};
}

export async function deleteCampaign(
  campaignId: string
): Promise<{ error?: string }> {
  const auth = await requirePlatformAdmin();
  if ("error" in auth) return auth;

  await db.campaign.update({
    where: { id: campaignId },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    campaignId,
    userId: auth.session.user.id,
    action: "CAMPAIGN_DELETED",
    entityType: "campaign",
    entityId: campaignId,
  });

  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath("/admin/campaigns");
  return {};
}

export async function restoreCampaign(
  campaignId: string
): Promise<{ error?: string }> {
  const auth = await requirePlatformAdmin();
  if ("error" in auth) return auth;

  if (!isSuperUser(auth.session.user.platformRole)) {
    return { error: "Super user access required to restore a campaign." };
  }

  await db.campaign.update({
    where: { id: campaignId },
    data: { deletedAt: null },
  });

  await createAuditLog({
    campaignId,
    userId: auth.session.user.id,
    action: "CAMPAIGN_RESTORED",
    entityType: "campaign",
    entityId: campaignId,
  });

  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath("/admin/campaigns");
  return {};
}

// ── Campaign override actions ─────────────────────────────────────────────────

export async function getCampaignOverride(
  campaignId: string,
): Promise<CampaignOverride | null> {
  const session = await getServerSession(authOptions);
  if (!session || !isSuperAdmin(session.user.platformRole)) return null;

  return db.campaignOverride.findUnique({ where: { campaignId } });
}

export interface SerializableLimits {
  constituentLimit:         number;
  canvasserLimit:           number;
  coChairLimit:             number;
  fieldOrganizerLimit:      number;
  donorTrackingEnabled:     boolean;
  followUpQueueEnabled:     boolean;
  analyticsEnabled:         boolean;
  eventsEnabled:            boolean;
  surveysEnabled:           boolean;
  digitalSignaturesEnabled: boolean;
  customFieldsEnabled:      boolean;
  signTrackingEnabled:      boolean;
  contactMapEnabled:        boolean;
  reportsEnabled:           boolean;
  canvassScriptEnabled:     boolean;
}

export async function getCampaignEffectiveLimits(
  campaignId: string,
): Promise<SerializableLimits | null> {
  const session = await getServerSession(authOptions);
  if (!session || !isSuperAdmin(session.user.platformRole)) return null;

  const limits = await getEffectiveLimits(campaignId);
  return {
    constituentLimit:         limits.constituentLimit,
    canvasserLimit:           limits.canvasserLimit,
    coChairLimit:             limits.coChairLimit,
    fieldOrganizerLimit:      limits.fieldOrganizerLimit,
    donorTrackingEnabled:     limits.donorTrackingEnabled,
    followUpQueueEnabled:     limits.followUpQueueEnabled,
    analyticsEnabled:         limits.analyticsEnabled,
    eventsEnabled:            limits.eventsEnabled,
    surveysEnabled:           limits.surveysEnabled,
    digitalSignaturesEnabled: limits.digitalSignaturesEnabled,
    customFieldsEnabled:      limits.customFieldsEnabled,
    signTrackingEnabled:      limits.signTrackingEnabled,
    contactMapEnabled:        limits.contactMapEnabled,
    reportsEnabled:           limits.reportsEnabled,
    canvassScriptEnabled:     limits.canvassScriptEnabled,
  };
}

export interface OverrideData {
  canvasserLimit?:            number | null;
  extraCanvassers?:           number | null;
  constituentLimit?:          number | null;
  coChairLimit?:              number | null;
  fieldOrganizerLimit?:       number | null;
  donorTrackingEnabled?:      boolean | null;
  followUpQueueEnabled?:      boolean | null;
  analyticsEnabled?:          boolean | null;
  eventsEnabled?:             boolean | null;
  surveysEnabled?:            boolean | null;
  digitalSignaturesEnabled?:  boolean | null;
  customFieldsEnabled?:       boolean | null;
  signTrackingEnabled?:       boolean | null;
  contactMapEnabled?:         boolean | null;
  reportsEnabled?:            boolean | null;
  canvassScriptEnabled?:      boolean | null;
  notesInternal?:             string | null;
}

export async function upsertCampaignOverride(
  campaignId: string,
  data: OverrideData,
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };
  if (!isSuperAdmin(session.user.platformRole)) {
    return { error: "Platform admin access required." };
  }

  const userId = session.user.id;

  const existing = await db.campaignOverride.findUnique({ where: { campaignId } });
  const isNew = !existing;

  const writeData = {
    canvasserLimit:           data.canvasserLimit           ?? null,
    extraCanvassers:          data.extraCanvassers           ?? null,
    constituentLimit:         data.constituentLimit          ?? null,
    coChairLimit:             data.coChairLimit              ?? null,
    fieldOrganizerLimit:      data.fieldOrganizerLimit       ?? null,
    donorTrackingEnabled:     data.donorTrackingEnabled      ?? null,
    followUpQueueEnabled:     data.followUpQueueEnabled      ?? null,
    analyticsEnabled:         data.analyticsEnabled          ?? null,
    eventsEnabled:            data.eventsEnabled             ?? null,
    surveysEnabled:           data.surveysEnabled            ?? null,
    digitalSignaturesEnabled: data.digitalSignaturesEnabled  ?? null,
    customFieldsEnabled:      data.customFieldsEnabled       ?? null,
    signTrackingEnabled:      data.signTrackingEnabled       ?? null,
    contactMapEnabled:        data.contactMapEnabled         ?? null,
    reportsEnabled:           data.reportsEnabled            ?? null,
    canvassScriptEnabled:     data.canvassScriptEnabled      ?? null,
    notesInternal:            data.notesInternal?.trim()     || null,
    grantedBy:                userId,
    ...(isNew && { grantedAt: new Date() }),
  };

  await db.campaignOverride.upsert({
    where:  { campaignId },
    create: { campaignId, ...writeData },
    update: writeData,
  });

  const changed: Record<string, { from: unknown; to: unknown }> = {};
  const fields = Object.keys(data) as (keyof OverrideData)[];
  for (const field of fields) {
    const prev = existing ? (existing[field as keyof typeof existing] ?? null) : null;
    const next = data[field] ?? null;
    if (String(prev) !== String(next)) {
      changed[field] = { from: prev, to: next };
    }
  }

  await createAuditLog({
    campaignId,
    userId,
    action:     "CAMPAIGN_OVERRIDE_UPDATED",
    entityType: "campaign_override",
    entityId:   campaignId,
    details:    { isNew, changed, notesInternal: data.notesInternal?.trim() || null },
  });

  revalidatePath(`/admin/campaigns/${campaignId}`);
  return {};
}

// ── Admin role management (super_user only) ───────────────────────────────────

export async function adminChangeUserRole(
  campaignId: string,
  membershipId: string,
  newRole: Role
): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  const membership = await db.campaignMembership.findFirst({
    where: { id: membershipId, campaignId, deletedAt: null },
    select: { id: true, userId: true, role: true },
  });
  if (!membership) return { error: "Membership not found." };

  if (membership.role === Role.candidate) {
    return { error: "Use transfer to reassign the candidate role." };
  }

  if (newRole === Role.candidate) {
    const existingCandidate = await db.campaignMembership.findFirst({
      where: { campaignId, role: Role.candidate, deletedAt: null, id: { not: membershipId } },
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
    campaignId,
    userId: auth.session.user.id,
    action: "ROLE_CHANGED",
    entityType: "campaign_membership",
    entityId: membershipId,
    details: { targetUserId: membership.userId, previousRole, newRole, changedByAdmin: true },
  });

  revalidatePath(`/admin/campaigns/${campaignId}`);
  return {};
}

export async function adminTransferCandidateRole(
  campaignId: string,
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
      where: { id: currentCandidateMembershipId, campaignId, deletedAt: null },
      select: { id: true, userId: true, role: true },
    }),
    db.campaignMembership.findFirst({
      where: { id: newCandidateMembershipId, campaignId, deletedAt: null },
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

  revalidatePath(`/admin/campaigns/${campaignId}`);
  return {};
}

// ── Support access admin actions ──────────────────────────────────────────────

export async function getAdminSupportAccessStatus(
  campaignId: string
): Promise<SupportAccessStatusResult> {
  return getSupportAccessStatus(campaignId);
}

export async function requestSupportAccessAction(
  campaignId: string,
  note: string
): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  const result = await requestSupportAccess(campaignId, auth.session.user.id, note);
  if (result.error) return result;

  revalidatePath(`/admin/campaigns/${campaignId}`);
  return {};
}

export async function cancelSupportAccessRequestAction(
  campaignId: string
): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  const result = await cancelSupportAccessRequest(campaignId, auth.session.user.id);
  if (result.error) return result;

  revalidatePath(`/admin/campaigns/${campaignId}`);
  return {};
}

export async function revokeSupportAccessAdminAction(
  campaignId: string
): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  const result = await revokeSupportAccess(campaignId, auth.session.user.id);
  if (result.error) return result;

  revalidatePath(`/admin/campaigns/${campaignId}`);
  return {};
}

export async function validateSupportEntry(
  campaignId: string,
  mode: "readonly" | "full"
): Promise<{ error?: string; campaignName?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  if (mode === "full") {
    const hasAccess = await hasActiveFullAccess(campaignId);
    if (!hasAccess) {
      return { error: "No active full-access grant for this campaign. Request and await approval first." };
    }
  }

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true },
  });
  if (!campaign) return { error: "Campaign not found." };

  await createAuditLog({
    campaignId,
    userId: auth.session.user.id,
    action: mode === "full" ? "SUPPORT_SESSION_ENTERED_FULL" : "SUPPORT_SESSION_ENTERED_READONLY",
    entityType: "campaign",
    entityId: campaignId,
    details: { mode },
  });

  return { campaignName: campaign.name };
}
