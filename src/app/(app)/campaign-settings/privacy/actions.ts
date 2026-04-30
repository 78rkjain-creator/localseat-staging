"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

const ALLOWED_ROLES = ["candidate", "campaign_manager", "data_manager"] as const;

async function getSession() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!ALLOWED_ROLES.includes(activeRole as (typeof ALLOWED_ROLES)[number])) redirect("/dashboard");
  return { activeCampaignId };
}

export async function updateDataRetention(months: number | null) {
  const { activeCampaignId } = await getSession();
  await db.campaign.update({
    where: { id: activeCampaignId },
    data: { dataRetentionMonths: months },
  });
  revalidatePath("/campaign-settings/privacy");
}
