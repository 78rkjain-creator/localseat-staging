import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const TIERS = ["starter", "campaign", "election"] as const;

const FEATURE_KEYS = [
  "donor_tracking",
  "follow_up_queue",
  "analytics",
  "volunteer_coordination",
  "finance_lead_access",
  "co_chair_seats",
  "unlimited_canvassers",
  "unlimited_constituents",
] as const;

const LIMIT_KEYS = [
  "constituent_limit",
  "canvasser_limit",
  "campaign_manager_limit",
  "cochair_limit",
  "field_organizer_limit",
] as const;

const TIER_DEFAULTS: Record<string, { regularPrice: string; salePrice: string | null }> = {
  starter:  { regularPrice: "249", salePrice: "149" },
  campaign: { regularPrice: "499", salePrice: "349" },
  election: { regularPrice: "999", salePrice: "699" },
};

const LIMIT_DEFAULTS: Record<string, Record<string, number>> = {
  starter:  { constituent_limit: 5000, canvasser_limit: 3,  campaign_manager_limit: 1, cochair_limit: 0, field_organizer_limit: 1 },
  campaign: { constituent_limit: 15000, canvasser_limit: 0, campaign_manager_limit: 0, cochair_limit: 2, field_organizer_limit: 0 },
  election: { constituent_limit: 0,    canvasser_limit: 0,  campaign_manager_limit: 0, cochair_limit: 0, field_organizer_limit: 0 },
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300",
};

export async function GET() {
  const rows = await db.platformSettings.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const tiers = Object.fromEntries(
    TIERS.map((tier) => {
      const defaults = TIER_DEFAULTS[tier];
      const regularPrice = map[`${tier}_regular_price`] ?? defaults.regularPrice;
      const salePrice    = map[`${tier}_sale_price`]    ?? defaults.salePrice;
      const label        = map[`${tier}_label`] ?? (tier.charAt(0).toUpperCase() + tier.slice(1));

      const features = Object.fromEntries(
        FEATURE_KEYS.map((key) => [key, map[`${tier}_feature_${key}`] === "true"]),
      );

      const limits = Object.fromEntries(
        LIMIT_KEYS.map((key) => {
          const raw = map[`${tier}_${key}`];
          const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
          return [key, isNaN(parsed) ? LIMIT_DEFAULTS[tier][key] : parsed];
        }),
      );

      return [tier, { label, regularPrice, salePrice, limits, features }];
    }),
  );

  return NextResponse.json({ tiers }, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
