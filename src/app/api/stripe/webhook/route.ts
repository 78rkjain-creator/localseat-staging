import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { buildPlanSnapshot } from "@/app/onboarding/choose-plan/actions";
import type { PlanTier } from "@/lib/plan-limits";
import { Role } from "@prisma/client";

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

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
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

  const { pendingId, campaignId, plan, userId, previousAmountPaid, promoCodeId } = session.metadata ?? {};

  if (!plan || !userId) {
    console.error("[stripe/webhook] Missing required metadata on session", session.id);
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  // ── New campaign: create from PendingCampaign ─────────────────────────────
  if (pendingId) {
    // Idempotency: check if this session was already processed
    const existingEntries = await db.auditLog.findMany({
      where: { action: "PLAN_PURCHASED" },
      select: { after: true },
      take: 100,
    });
    const alreadyProcessed = existingEntries.some((entry) => {
      const d = entry.after as { stripeSessionId?: string } | null;
      return d?.stripeSessionId === session.id;
    });
    if (alreadyProcessed) {
      return NextResponse.json({ received: true });
    }

    const pending = await db.pendingCampaign.findUnique({
      where: { id: pendingId },
    });
    if (!pending) {
      console.error("[stripe/webhook] PendingCampaign not found:", pendingId);
      return NextResponse.json({ error: "Pending campaign not found" }, { status: 400 });
    }

    const amountPaidDollars = Math.round((session.amount_total ?? 0) / 100);
    const subtotalDollars   = Math.round((session.amount_subtotal ?? session.amount_total ?? 0) / 100);
    const discountDollars   = Math.max(subtotalDollars - amountPaidDollars, 0);

    const snapshotData = await buildPlanSnapshot(plan as PlanTier, amountPaidDollars);

    // Determine role: first campaign = candidate, subsequent = campaign_manager
    const existingMemberships = await db.campaignMembership.count({
      where: { userId: pending.userId, deletedAt: null },
    });
    const membershipRole = existingMemberships > 0 ? Role.campaign_manager : Role.candidate;

    // Create the real campaign + membership + default tags in a transaction
    const campaign = await db.$transaction(async (tx) => {
      const newCampaign = await tx.campaign.create({
        data: {
          name: pending.name,
          ...(pending.ballotName ? { ballotName: pending.ballotName } : {}),
          ...(pending.officeSought ? { officeSought: pending.officeSought } : {}),
          ...(pending.city ? { municipality: pending.city, city: pending.city } : { city: "" }),
          ...(pending.municipalityName ? { municipalityName: pending.municipalityName } : {}),
          ...(pending.municipalityId ? { municipalityId: pending.municipalityId } : {}),
          ...(pending.municipalityBoundary ? { municipalityBoundary: pending.municipalityBoundary } : {}),
          wards: pending.wards,
          province: pending.province,
          year: pending.year,
          ...(pending.electionDate ? { electionDate: pending.electionDate } : {}),
          campaignElectionType: pending.campaignElectionType,
          plan: plan as PlanTier,
          planActivated: true,
          planLockedAt: new Date(),
          amountPaid: amountPaidDollars,
          advanceVotingDates: [],
          ...(promoCodeId ? { promoCodeId } : {}),
          memberships: {
            create: {
              userId: pending.userId,
              role: membershipRole,
            },
          },
        },
      });

      // Default tags
      await tx.tag.createMany({
        data: [
          { campaignId: newCampaign.id, name: "Volunteer",      color: "#22c55e" },
          { campaignId: newCampaign.id, name: "Donor",          color: "#f97316" },
          { campaignId: newCampaign.id, name: "Endorser",       color: null      },
          { campaignId: newCampaign.id, name: "Sign location",  color: "#eab308" },
          { campaignId: newCampaign.id, name: "Do not contact", color: "#ef4444" },
          { campaignId: newCampaign.id, name: "Media",          color: null      },
          { campaignId: newCampaign.id, name: "VIP",            color: "#f97316" },
          { campaignId: newCampaign.id, name: "Influencer",     color: null      },
        ],
      });

      // Default signature consent types
      await tx.signatureConsentType.createMany({
        data: [
          { campaignId: newCampaign.id, label: "Lawn sign consent", sortOrder: 0 },
          { campaignId: newCampaign.id, label: "Volunteer consent",  sortOrder: 1 },
          { campaignId: newCampaign.id, label: "Petition",           sortOrder: 2 },
          { campaignId: newCampaign.id, label: "Other",              sortOrder: 3 },
        ],
      });

      // Plan override snapshot
      await tx.campaignOverride.create({
        data: { campaignId: newCampaign.id, ...snapshotData },
      });

      // Clean up the pending record
      await tx.pendingCampaign.delete({ where: { id: pendingId } });

      return newCampaign;
    });

    // Promo code tracking
    if (promoCodeId) {
      await db.promoCode.update({
        where: { id: promoCodeId },
        data: {
          usageCount:     { increment: 1 },
          totalRevenue:   { increment: amountPaidDollars },
          totalDiscounts: { increment: discountDollars },
        },
      });
    }

    await createAuditLog({
      campaignId: campaign.id,
      userId,
      action:     "PLAN_PURCHASED",
      entityType: "campaign",
      entityId:   campaign.id,
      details: {
        plan,
        stripeSessionId:    session.id,
        amountCharged:      amountPaidDollars,
        totalAmountPaid:    amountPaidDollars,
        previousAmountPaid: 0,
        discountApplied:    discountDollars,
        promoCodeId:        promoCodeId ?? null,
        snapshotedAt:       snapshotData.snapshotedAt,
        createdFromPending: pendingId,
      },
    });

    await createAuditLog({
      campaignId: campaign.id,
      userId,
      action:     "CAMPAIGN_CREATED",
      entityType: "campaign",
      entityId:   campaign.id,
      details: { name: pending.name, officeSought: pending.officeSought, municipality: pending.city },
    });

    console.log(`[stripe/webhook] Campaign created from pending: campaign=${campaign.id} plan=${plan} amount=${amountPaidDollars}`);
    return NextResponse.json({ received: true });
  }

  // ── Existing campaign upgrade ─────────────────────────────────────────────
  if (!campaignId) {
    console.error("[stripe/webhook] Missing both pendingId and campaignId in metadata", session.id);
    return NextResponse.json({ error: "Missing campaign reference" }, { status: 400 });
  }

  // Idempotency check
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

  const amountPaidDollars  = Math.round((session.amount_total    ?? 0) / 100);
  const subtotalDollars    = Math.round((session.amount_subtotal ?? session.amount_total ?? 0) / 100);
  const discountDollars    = Math.max(subtotalDollars - amountPaidDollars, 0);
  const previousPaid       = parseInt(previousAmountPaid ?? "0", 10);
  const totalAmountPaid    = previousPaid + amountPaidDollars;

  const snapshotData = await buildPlanSnapshot(plan as PlanTier, totalAmountPaid);

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      plan:          plan as PlanTier,
      planActivated: true,
      planLockedAt:  new Date(),
      amountPaid:    totalAmountPaid,
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
        usageCount:     { increment: 1 },
        totalRevenue:   { increment: amountPaidDollars },
        totalDiscounts: { increment: discountDollars },
      },
    });
  }

  await createAuditLog({
    campaignId,
    userId,
    action:     "PLAN_PURCHASED",
    entityType: "campaign",
    entityId:   campaignId,
    details: {
      plan,
      stripeSessionId:    session.id,
      amountCharged:      amountPaidDollars,
      totalAmountPaid,
      previousAmountPaid: previousPaid,
      discountApplied:    discountDollars,
      promoCodeId:        promoCodeId ?? null,
      snapshotedAt:       snapshotData.snapshotedAt,
    },
  });

  console.log(`[stripe/webhook] Plan activated: campaign=${campaignId} plan=${plan} amount=${totalAmountPaid}`);
  return NextResponse.json({ received: true });
}
