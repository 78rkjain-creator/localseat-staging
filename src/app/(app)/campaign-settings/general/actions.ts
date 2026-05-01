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

  // Advance voting dates — submitted as indexed pairs: advanceDate_0, advanceTime_0, …
  const countRaw = formData.get("advanceDateCount") as string | null;
  const count = parseInt(countRaw ?? "0", 10) || 0;
  const advanceVotingDates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const dateStr = (formData.get(`advanceDate_${i}`) as string | null)?.trim();
    const timeStr = (formData.get(`advanceTime_${i}`) as string | null)?.trim() || "00:00";
    if (dateStr) {
      const d = new Date(`${dateStr}T${timeStr}:00.000Z`);
      if (!isNaN(d.getTime())) advanceVotingDates.push(d);
    }
  }
  // Sort ascending before save
  advanceVotingDates.sort((a, b) => a.getTime() - b.getTime());

  try {
    await db.campaign.update({
      where: { id: activeCampaignId },
      data: { name, electionDate, fundraisingGoal, advanceVotingDates },
    });
  } catch {
    return { error: "Failed to save settings. Please try again." };
  }

  revalidatePath("/campaign-settings/general");
  revalidatePath("/dashboard");
  return { success: true };
}
