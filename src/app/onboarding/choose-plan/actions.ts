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
  bench:  { constituentLimit: 5000,   canvasserLimit: 3 },
  chair:  { constituentLimit: 15000,  canvasserLimit: 0 },
  podium: { constituentLimit: 50000,  canvasserLimit: 0 },
  stage:  { constituentLimit: 250000, canvasserLimit: 0 },
  arena:  { constituentLimit: 0,      canvasserLimit: 0 },
};

export async function getTierPricing(): Promise<Record<string, TierPricing>> {
  const rows = await db.platformSettings.findMany({
    where: {
      key: {
        in: [
          "bench_label",  "bench_regular_price",  "bench_sale_price",
          "chair_label",  "chair_regular_price",  "chair_sale_price",
          "podium_label", "podium_regular_price", "podium_sale_price",
          "stage_label",  "stage_regular_price",  "stage_sale_price",
          "arena_label",  "arena_regular_price",  "arena_sale_price",
          "bench_constituent_limit",  "bench_canvasser_limit",
          "chair_constituent_limit",  "chair_canvasser_limit",
          "podium_constituent_limit", "podium_canvasser_limit",
          "stage_constituent_limit",  "stage_canvasser_limit",
          "arena_constituent_limit",  "arena_canvasser_limit",
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
    bench:  tierPricing("bench",  "249",  "149"),
    chair:  tierPricing("chair",  "499",  "349"),
    podium: tierPricing("podium", "999",  "699"),
    stage:  tierPricing("stage",  "1499", "1099"),
    arena:  tierPricing("arena",  "1999", "1499"),
  };
}

// ── Snapshot builder ───────────────────────────────────────────────────────
// Reads current PlatformSettings and builds the CampaignOverride snapshot
// data for a given plan tier. Called by both selectPlanDev and the Stripe
// webhook so the snapshot logic lives in one place.
//
// amountPaid: if provided (Stripe webhook), uses the actual charge amount.
//             If omitted (dev mode), derives it from current settings.

export async function buildPlanSnapshot(plan: PlanTier, amountPaidOverride?: number) {
  const settingsRows = await db.platformSettings.findMany();
  const settings = new Map(settingsRows.map((r) => [r.key, r.value]));

  const regularPrice = parseInt(settings.get(`${plan}_regular_price`) ?? "0", 10);
  const salePriceRaw = settings.get(`${plan}_sale_price`);
  const salePrice    = salePriceRaw ? parseInt(salePriceRaw, 10) : null;
  const derivedAmount = salePrice ?? regularPrice;

  const amountPaid = amountPaidOverride ?? derivedAmount;

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

  return {
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
    snapshotTagLimit:              numSetting(`${plan}_tag_limit`),
    snapshotCustomFieldLimit:      numSetting(`${plan}_custom_field_limit`),
    snapshotPricePaid:             amountPaid || null,
    snapshotRegularPrice:          regularPrice || null,
    snapshotSalePrice:             salePrice,
    snapshotedAt:                  new Date(),
  };
}

// ── Dev plan selection ─────────────────────────────────────────────────────

const SELECTABLE_PLANS: PlanTier[] = ["bench", "chair", "podium", "stage", "arena"];

export async function selectPlanDev(
  campaignId: string,
  plan: PlanTier,
  promoCode?: string,
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

  // Resolve promo code if provided
  let promoCodeId: string | undefined;
  if (promoCode) {
    const promo = await db.promoCode.findUnique({
      where: { code: promoCode.toUpperCase() },
      select: { id: true, isActive: true, expiresAt: true, maxUses: true, usageCount: true },
    });
    if (promo?.isActive) promoCodeId = promo.id;
  }

  const snapshotData = await buildPlanSnapshot(plan);

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      plan,
      planActivated: true,
      planLockedAt:  new Date(),
      amountPaid:    snapshotData.snapshotPricePaid ?? 0,
      ...(promoCodeId ? { promoCodeId } : {}),
    },
  });

  await db.campaignOverride.upsert({
    where:  { campaignId },
    create: { campaignId, ...snapshotData },
    update: snapshotData,
  });

  if (promoCodeId) {
    await db.promoCode.update({
      where: { id: promoCodeId },
      data: {
        usageCount:   { increment: 1 },
        totalRevenue: { increment: snapshotData.snapshotPricePaid ?? 0 },
      },
    });
  }

  await createAuditLog({
    campaignId,
    userId:     session.user.id,
    action:     "PLAN_SELECTED_DEV",
    entityType: "campaign",
    entityId:   campaignId,
    details:    { plan, devMode: true, amountPaid: snapshotData.snapshotPricePaid, promoCode: promoCode ?? null, snapshotedAt: snapshotData.snapshotedAt },
  });

  revalidatePath("/dashboard");
  return {};
}
