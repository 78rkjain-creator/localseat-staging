"use server";

import { addCompetitor, updateCompetitor, deleteCompetitor } from "@/lib/competitors";

export async function addCompetitorAction(campaignId: string, name: string) {
  try {
    const competitor = await addCompetitor(campaignId, name);
    return { competitor };
  } catch {
    return { error: "Something went wrong" };
  }
}

export async function updateCompetitorAction(id: string, campaignId: string, name: string) {
  try {
    const competitor = await updateCompetitor(id, campaignId, name);
    return { competitor };
  } catch {
    return { error: "Something went wrong" };
  }
}

export async function deleteCompetitorAction(id: string, campaignId: string) {
  try {
    await deleteCompetitor(id, campaignId);
    return { success: true as const };
  } catch {
    return { error: "Something went wrong" };
  }
}
