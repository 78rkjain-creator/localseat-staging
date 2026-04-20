"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSuperAdmin, isSuperUser } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { getEffectiveLimits } from "@/lib/plan-limits";
import type { CampaignOverride } from "@prisma/client";

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requirePlatformAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  if (!isSuperAdmin(session.user.platformRole)) {
    return { error: "Platform admin access required." } as const;
  }
  return { session } as const;
}

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

  // Restore is super_user only
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
  constituentLimit:     number;
  canvasserLimit:       number;
  coChairLimit:         number;
  fieldOrganizerLimit:  number;
  donorTrackingEnabled: boolean;
}

export async function getCampaignEffectiveLimits(
  campaignId: string,
): Promise<SerializableLimits | null> {
  const session = await getServerSession(authOptions);
  if (!session || !isSuperAdmin(session.user.platformRole)) return null;

  const limits = await getEffectiveLimits(campaignId);
  return {
    constituentLimit:     limits.constituentLimit,
    canvasserLimit:       limits.canvasserLimit,
    coChairLimit:         limits.coChairLimit,
    fieldOrganizerLimit:  limits.fieldOrganizerLimit,
    donorTrackingEnabled: limits.donorTrackingEnabled,
  };
}

export interface OverrideData {
  canvasserLimit?:       number | null;
  extraCanvassers?:      number | null;
  constituentLimit?:     number | null;
  coChairLimit?:         number | null;
  fieldOrganizerLimit?:  number | null;
  donorTrackingEnabled?: boolean | null;
  notesInternal?:        string | null;
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

  // Capture existing values for audit diff
  const existing = await db.campaignOverride.findUnique({ where: { campaignId } });
  const isNew = !existing;

  const writeData = {
    canvasserLimit:      data.canvasserLimit      ?? null,
    extraCanvassers:     data.extraCanvassers      ?? null,
    constituentLimit:    data.constituentLimit     ?? null,
    coChairLimit:        data.coChairLimit         ?? null,
    fieldOrganizerLimit: data.fieldOrganizerLimit  ?? null,
    donorTrackingEnabled: data.donorTrackingEnabled ?? null,
    notesInternal:       data.notesInternal?.trim() || null,
    grantedBy:           userId,
    ...(isNew && { grantedAt: new Date() }),
  };

  await db.campaignOverride.upsert({
    where:  { campaignId },
    create: { campaignId, ...writeData },
    update: writeData,
  });

  // Build audit diff
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
