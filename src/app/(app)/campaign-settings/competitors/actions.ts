"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addCompetitor, updateCompetitor, deleteCompetitor } from "@/lib/competitors";

async function requireCampaignManager() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (activeRole !== "candidate" && activeRole !== "campaign_manager" && activeRole !== "data_manager") {
    return { error: "Forbidden." } as const;
  }
  return { campaignId: activeCampaignId } as const;
}

export async function addCompetitorAction(name: string) {
  const auth = await requireCampaignManager();
  if ("error" in auth) return { error: auth.error };
  try {
    const competitor = await addCompetitor(auth.campaignId, name);
    return { competitor };
  } catch {
    return { error: "Something went wrong" };
  }
}

export async function updateCompetitorAction(id: string, name: string) {
  const auth = await requireCampaignManager();
  if ("error" in auth) return { error: auth.error };
  try {
    const competitor = await updateCompetitor(id, auth.campaignId, name);
    return { competitor };
  } catch {
    return { error: "Something went wrong" };
  }
}

export async function deleteCompetitorAction(id: string) {
  const auth = await requireCampaignManager();
  if ("error" in auth) return { error: auth.error };
  try {
    await deleteCompetitor(id, auth.campaignId);
    return { success: true as const };
  } catch {
    return { error: "Something went wrong" };
  }
}
