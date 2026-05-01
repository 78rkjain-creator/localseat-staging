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
  label:            string;
  price:            string;  // effective price (sale if available, else regular)
  regularPrice:     string;
  salePrice:        string | null;
  constituentLimit: number;
  canvasserLimit:   number;
}

const LIMIT_DEFAULTS: Record<string, { constituentLimit: number; canvasserLimit: number }> = {
  starter:  { constituentLimit: 5000,  canvasserLimit: 3 },
  campaign: { constituentLimit: 15000, canvasserLimit: 0 },
  election: { constituentLimit: 0,     canvasserLimit: 0 },
};

export async function getTierPricing(): Promise<Record<string, TierPricing>> {
  const rows = await db.platformSettings.findMany({
    where: {
      key: {
        in: [
          "starter_label",  "starter_regular_price",  "starter_sale_price",
          "campaign_label", "campaign_regular_price", "campaign_sale_price",
          "election_label", "election_regular_price", "election_sale_price",
          "starter_constituent_limit",  "starter_canvasser_limit",
          "campaign_constituent_limit", "campaign_canvasser_limit",
          "election_constituent_limit", "election_canvasser_limit",
        ],
      },
    },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  function parseLimit(raw: string | undefined, fallback: number): number {
    if (raw === undefined) return fallback;
    const n = parseInt(raw, 10);
    return isNaN(n) ? fallback : n;
  }

  function tierPricing(tier: string, defaultRegular: string, defaultSale: string | null): TierPricing {
    const label        = map[`${tier}_label`]         ?? tier.charAt(0).toUpperCase() + tier.slice(1);
    const regularPrice = map[`${tier}_regular_price`] ?? defaultRegular;
    const salePrice    = map[`${tier}_sale_price`]    ?? defaultSale;
    const price        = salePrice ?? regularPrice;
    const defaults     = LIMIT_DEFAULTS[tier] ?? { constituentLimit: 0, canvasserLimit: 0 };
    const constituentLimit = parseLimit(map[`${tier}_constituent_limit`], defaults.constituentLimit);
    const canvasserLimit   = parseLimit(map[`${tier}_canvasser_limit`],   defaults.canvasserLimit);
    return { label, price, regularPrice, salePrice: salePrice ?? null, constituentLimit, canvasserLimit };
  }

  return {
    starter:  tierPricing("starter",  "249", "149"),
    campaign: tierPricing("campaign", "499", "349"),
    election: tierPricing("election", "999", "699"),
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

  const membership = await db.campaignMembership.findFirst({
    where: {
      campaignId,
      userId: session.user.id,
      role: { in: ["candidate", "campaign_manager", "data_manager"] },
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

  // Read current tier pricing + settings for snapshot
  const settingsRows = await db.platformSettings.findMany();
  const settings = new Map(settingsRows.map((r) => [r.key, r.value]));

  const regularPrice = parseInt(settings.get(`${plan}_regular_price`) ?? "0", 10);
  const salePriceRaw = settings.get(`${plan}_sale_price`);
  const salePrice    = salePriceRaw ? parseInt(salePriceRaw, 10) : null;
  const amountPaid   = salePrice ?? regularPrice;

  function numSetting(key: string): number | null {
    const raw = settings.get(key);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  }

  function boolSetting(key: string): boolean | null {
    const raw = settings.get(key);
    if (raw === undefined) return null;
    return raw === "true";
  }

  const snapshotData = {
    snapshotConstituentLimit:      numSetting(`${plan}_constituent_limit`),
    snapshotCanvasserLimit:        numSetting(`${plan}_canvasser_limit`),
    snapshotCampaignManagerLimit:  numSetting(`${plan}_campaign_manager_limit`),
    snapshotCoChairLimit:          numSetting(`${plan}_cochair_limit`),
    snapshotFieldOrganizerLimit:   numSetting(`${plan}_field_organizer_limit`),
    snapshotDonorTracking:         boolSetting(`${plan}_feature_donor_tracking`),
    snapshotFollowUpQueue:         boolSetting(`${plan}_feature_follow_up_queue`),
    snapshotAnalytics:             boolSetting(`${plan}_feature_analytics`),
    snapshotVolunteerCoord:        boolSetting(`${plan}_feature_volunteer_coordination`),
    snapshotFinanceLeadAccess:     boolSetting(`${plan}_feature_finance_lead_access`),
    snapshotCoChairSeats:          boolSetting(`${plan}_feature_co_chair_seats`),
    snapshotUnlimitedCanvassers:   boolSetting(`${plan}_feature_unlimited_canvassers`),
    snapshotUnlimitedConstituents: boolSetting(`${plan}_feature_unlimited_constituents`),
    snapshotEvents:                boolSetting(`${plan}_feature_events`),
    snapshotSurveys:               boolSetting(`${plan}_feature_surveys`),
    snapshotDigitalSignatures:     boolSetting(`${plan}_feature_digital_signatures`),
    snapshotCustomFields:          boolSetting(`${plan}_feature_custom_fields`),
    snapshotSignTracking:          boolSetting(`${plan}_feature_sign_tracking`),
    snapshotContactMap:            boolSetting(`${plan}_feature_contact_map`),
    snapshotReports:               boolSetting(`${plan}_feature_reports`),
    snapshotCanvassScript:         boolSetting(`${plan}_feature_canvass_script`),
    snapshotPricePaid:             amountPaid || null,
    snapshotRegularPrice:          regularPrice || null,
    snapshotSalePrice:             salePrice,
    snapshotedAt:                  new Date(),
  };

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      plan,
      planActivated: true,
      planLockedAt:  new Date(),
      amountPaid,
    },
  });

  // Upsert override record with snapshot — preserves any existing manual overrides
  await db.campaignOverride.upsert({
    where:  { campaignId },
    create: { campaignId, ...snapshotData },
    update: snapshotData,
  });

  await createAuditLog({
    campaignId,
    userId:     session.user.id,
    action:     "PLAN_SELECTED_DEV",
    entityType: "campaign",
    entityId:   campaignId,
    details:    { plan, devMode: true, amountPaid, snapshotedAt: snapshotData.snapshotedAt },
  });

  revalidatePath("/dashboard");
  return {};
}
