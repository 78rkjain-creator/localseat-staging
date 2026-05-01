"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  approveSupportAccess,
  denySupportAccess,
  revokeSupportAccess,
} from "@/lib/support-access";

async function requireCampaignManager() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (activeRole !== "candidate" && activeRole !== "campaign_manager") {
    return { error: "Only candidates and campaign managers can manage support access." } as const;
  }
  return { session, campaignId: activeCampaignId } as const;
}

export async function approveSupportAccessAction(grantId: string): Promise<void> {
  const auth = await requireCampaignManager();
  if ("error" in auth) return;

  await approveSupportAccess(grantId, auth.session.user.id);

  revalidatePath("/dashboard");
  revalidatePath("/campaign-settings/general");
}

export async function denySupportAccessAction(grantId: string): Promise<void> {
  const auth = await requireCampaignManager();
  if ("error" in auth) return;

  await denySupportAccess(grantId, auth.session.user.id);

  revalidatePath("/dashboard");
  revalidatePath("/campaign-settings/general");
}

export async function revokeSupportAccessAction(): Promise<void> {
  const auth = await requireCampaignManager();
  if ("error" in auth) return;

  await revokeSupportAccess(auth.campaignId, auth.session.user.id);

  revalidatePath("/dashboard");
  revalidatePath("/campaign-settings/general");
}
