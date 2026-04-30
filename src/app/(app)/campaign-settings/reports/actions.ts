"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Role } from "@/types";

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "data_manager", "co_chair"];

export async function saveReportSettings(input: {
  dailySummaryEnabled: boolean;
  dailySummaryEmail: string | null;
}): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    return { error: "Not authorized." };
  }

  await db.campaign.update({
    where: { id: activeCampaignId },
    data: {
      dailySummaryEnabled: input.dailySummaryEnabled,
      dailySummaryEmail: input.dailySummaryEmail,
    },
  });

  revalidatePath("/campaign-settings/reports");
  return {};
}
