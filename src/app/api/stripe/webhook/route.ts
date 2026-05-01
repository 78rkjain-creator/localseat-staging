import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { buildPlanSnapshot } from "@/app/onboarding/choose-plan/actions";
import type { PlanTier } from "@/lib/plan-limits";

// Next.js App Router: disable body parsing so we can read the raw bytes
// that Stripe uses for signature verification.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;

  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const { campaignId, plan, userId, previousAmountPaid } = session.metadata ?? {};

  if (!campaignId || !plan || !userId) {
    console.error("[stripe/webhook] Missing required metadata on session", session.id);
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  // Idempotency: skip if this session was already processed
  const existingEntries = await db.auditLog.findMany({
    where: { campaignId, action: "PLAN_PURCHASED" },
    select: { after: true },
  });
  const alreadyProcessed = existingEntries.some((entry) => {
    const d = entry.after as { stripeSessionId?: string } | null;
    return d?.stripeSessionId === session.id;
  });
  if (alreadyProcessed) {
    return NextResponse.json({ received: true });
  }

  // amount_total is in cents
  const amountPaidDollars = Math.round((session.amount_total ?? 0) / 100);
  const previousPaid = parseInt(previousAmountPaid ?? "0", 10);
  const totalAmountPaid = previousPaid + amountPaidDollars;

  const snapshotData = await buildPlanSnapshot(plan as PlanTier, totalAmountPaid);

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      plan:          plan as PlanTier,
      planActivated: true,
      planLockedAt:  new Date(),
      amountPaid:    totalAmountPaid,
    },
  });

  await db.campaignOverride.upsert({
    where:  { campaignId },
    create: { campaignId, ...snapshotData },
    update: snapshotData,
  });

  await createAuditLog({
    campaignId,
    userId,
    action:     "PLAN_PURCHASED",
    entityType: "campaign",
    entityId:   campaignId,
    details: {
      plan,
      stripeSessionId:  session.id,
      amountCharged:    amountPaidDollars,
      totalAmountPaid,
      previousAmountPaid: previousPaid,
      snapshotedAt: snapshotData.snapshotedAt,
    },
  });

  console.log(`[stripe/webhook] Plan activated: campaign=${campaignId} plan=${plan} amount=${totalAmountPaid}`);

  return NextResponse.json({ received: true });
}
