import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" as const });
  }
  return _stripe;
}

// Stripe product IDs (test mode) — one per plan tier
export const STRIPE_PRODUCTS: Record<string, string> = {
  starter:  "prod_UREJUkGMu182BI",
  campaign: "prod_URELmxFyywN5r7",
  election: "prod_URELAaHM1dfYNA",
};
