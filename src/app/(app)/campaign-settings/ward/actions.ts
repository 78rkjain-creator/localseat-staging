"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import type { Polygon } from "geojson";
import type { Role } from "@/types";

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "co_chair"];

export async function saveWardBoundary(
  polygon: Polygon
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    return { error: "You don't have permission to set the ward boundary." };
  }

  await db.campaign.update({
    where: { id: activeCampaignId },
    data: {
      wardBoundary: polygon as unknown as Prisma.InputJsonValue,
      wardBoundarySetAt: new Date(),
    },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "WARD_BOUNDARY_UPDATED",
    entityType: "Campaign",
    entityId: activeCampaignId,
    details: { wardBoundarySet: true },
  });

  revalidatePath("/campaign-settings/ward");
  return {};
}

export async function clearWardBoundary(): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    return { error: "You don't have permission to clear the ward boundary." };
  }

  await db.campaign.update({
    where: { id: activeCampaignId },
    data: {
      wardBoundary: Prisma.DbNull,
      wardBoundarySetAt: null,
    },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "WARD_BOUNDARY_CLEARED",
    entityType: "Campaign",
    entityId: activeCampaignId,
    details: { wardBoundarySet: false },
  });

  revalidatePath("/campaign-settings/ward");
  return {};
}
