"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export async function saveGeneralSettings(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole !== "candidate" && activeRole !== "campaign_manager") redirect("/dashboard");

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return;

  const electionDateRaw = formData.get("electionDate") as string | null;
  const fundraisingGoalRaw = formData.get("fundraisingGoal") as string | null;

  const electionDate = electionDateRaw
    ? new Date(`${electionDateRaw}T00:00:00.000Z`)
    : null;

  const fundraisingGoal =
    fundraisingGoalRaw && fundraisingGoalRaw.trim() !== ""
      ? Math.max(0, parseInt(fundraisingGoalRaw, 10))
      : null;

  await db.campaign.update({
    where: { id: activeCampaignId },
    data: { name, electionDate, fundraisingGoal },
  });

  revalidatePath("/campaign-settings/general");
  revalidatePath("/dashboard");
}
