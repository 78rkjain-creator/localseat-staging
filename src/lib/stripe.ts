import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as const,
});

// Stripe product IDs (test mode) — one per plan tier
export const STRIPE_PRODUCTS: Record<string, string> = {
  starter:  "prod_UREJUkGMu182BI",
  campaign: "prod_URELmxFyywN5r7",
  election: "prod_URELAaHM1dfYNA",
};
