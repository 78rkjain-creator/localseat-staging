"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export interface GeneralSettingsState {
  error?: string;
  success?: boolean;
}

export async function saveGeneralSettings(
  _prev: GeneralSettingsState,
  formData: FormData
): Promise<GeneralSettingsState> {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole !== "candidate" && activeRole !== "campaign_manager" && activeRole !== "data_manager") redirect("/dashboard");

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) return { error: "Campaign name is required." };

  const electionDateRaw = formData.get("electionDate") as string | null;
  const fundraisingGoalRaw = formData.get("fundraisingGoal") as string | null;

  const electionDate = electionDateRaw?.trim()
    ? new Date(`${electionDateRaw.trim()}T00:00:00.000Z`)
    : null;

  const parsedGoal = fundraisingGoalRaw?.trim()
    ? parseInt(fundraisingGoalRaw.trim(), 10)
    : NaN;
  const fundraisingGoal = !isNaN(parsedGoal) ? Math.max(0, parsedGoal) : null;

  try {
    await db.campaign.update({
      where: { id: activeCampaignId },
      data: { name, electionDate, fundraisingGoal },
    });
  } catch {
    return { error: "Failed to save settings. Please try again." };
  }

  revalidatePath("/campaign-settings/general");
  revalidatePath("/dashboard");
  return { success: true };
}
