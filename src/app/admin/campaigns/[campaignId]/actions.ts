"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSuperAdmin, isSuperUser } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

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
