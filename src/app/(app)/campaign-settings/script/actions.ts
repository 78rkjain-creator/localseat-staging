"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/types";

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "data_manager", "co_chair"];

export async function saveCanvassScript(
  script: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Unauthorized" };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign" };
  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    return { error: "Forbidden" };
  }

  await db.campaign.update({
    where: { id: activeCampaignId },
    data: { canvassScript: script.trim() || null },
  });

  revalidatePath("/campaign-settings/script");
  return {};
}
