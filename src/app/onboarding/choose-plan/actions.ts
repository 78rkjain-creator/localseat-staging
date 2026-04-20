"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import type { PlanTier } from "@/lib/plan-limits";

// ── Public pricing read ────────────────────────────────────────────────────
// No auth required — this is public-facing pricing data.

export interface TierPricing {
  label: string;
  price: string;
}

export async function getTierPricing(): Promise<Record<string, TierPricing>> {
  const rows = await db.platformSettings.findMany({
    where: {
      key: {
        in: [
          "starter_label",  "starter_price",
          "campaign_label", "campaign_price",
          "election_label", "election_price",
        ],
      },
    },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    starter:  { label: map["starter_label"]  ?? "Starter",  price: map["starter_price"]  ?? "149" },
    campaign: { label: map["campaign_label"] ?? "Campaign", price: map["campaign_price"] ?? "349" },
    election: { label: map["election_label"] ?? "Election", price: map["election_price"] ?? "699" },
  };
}

// ── Dev plan selection ─────────────────────────────────────────────────────

const SELECTABLE_PLANS: PlanTier[] = ["starter", "campaign", "election"];

export async function selectPlanDev(
  campaignId: string,
  plan: PlanTier,
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated." };

  if (!SELECTABLE_PLANS.includes(plan)) {
    return { error: "Invalid plan." };
  }

  // Verify the user is a member of this campaign with an eligible role
  const membership = await db.campaignMembership.findFirst({
    where: {
      campaignId,
      userId: session.user.id,
      role: { in: ["candidate", "campaign_manager"] },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!membership) {
    return { error: "You do not have permission to select a plan for this campaign." };
  }

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });

  if (!campaign) return { error: "Campaign not found." };

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      plan,
      planActivated: true,
      planLockedAt:  new Date(),
      amountPaid:    0,
    },
  });

  await createAuditLog({
    campaignId,
    userId:     session.user.id,
    action:     "PLAN_SELECTED_DEV",
    entityType: "campaign",
    entityId:   campaignId,
    details:    { plan, devMode: true },
  });

  revalidatePath("/dashboard");
  return {};
}
