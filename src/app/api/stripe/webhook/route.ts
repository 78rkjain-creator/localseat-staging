import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { buildPlanSnapshot } from "@/app/onboarding/choose-plan/actions";
import type { PlanTier } from "@/lib/plan-limits";
import { Role } from "@prisma/client";
import { sendPaymentReceivedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
];

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

  if (!HANDLED_EVENTS.includes(event.type)) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const { pendingId, campaignId, plan, userId, previousAmountPaid, promoCodeId } = session.metadata ?? {};

  // ── Async payment succeeded (delayed debit cleared) ───────────────────────
  if (event.type === "checkout.session.async_payment_succeeded") {
    const targetCampaignId = campaignId || null;

    // Find campaign by stripePaymentIntentId or campaignId from metadata
    const campaign = targetCampaignId
      ? await db.campaign.findUnique({ where: { id: targetCampaignId }, select: { id: true, name: true, paymentStatus: true } })
      : session.payment_intent
        ? await db.campaign.findFirst({ where: { stripePaymentIntentId: session.payment_intent as string }, select: { id: true, name: true, paymentStatus: true } })
        : null;

    if (!campaign) {
      console.error("[stripe/webhook] async_payment_succeeded: campaign not found", session.id);
      return NextResponse.json({ received: true });
    }

    await db.campaign.update({
      where: { id: campaign.id },
      data: {
        paymentStatus: "paid",
        paymentWarningsSent: 0,
        suspendedAt: null,
        isActive: true,
        amountPaid: Math.round((session.amount_total ?? 0) / 100),
      },
    });

    // Send confirmation email
    if (userId) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
      if (user) {
        await sendPaymentReceivedEmail({
          name: user.firstName,
          email: user.email,
          campaignName: campaign.name,
        });
      }
    }

    await createAuditLog({
      campaignId: campaign.id,
      userId: userId ?? undefined,
      action: "PAYMENT_CONFIRMED",
      entityType: "campaign",
      entityId: campaign.id,
      details: { stripeSessionId: session.id, previousStatus: campaign.paymentStatus },
    });

    console.log(`[stripe/webhook] Async payment confirmed: campaign=${campaign.id}`);
    return NextResponse.json({ received: true });
  }

  // ── Async payment failed (delayed debit bounced) ──────────────────────────
  if (event.type === "checkout.session.async_payment_failed") {
    const targetCampaignId = campaignId || null;

    const campaign = targetCampaignId
      ? await db.campaign.findUnique({ where: { id: targetCampaignId }, select: { id: true, name: true } })
      : session.payment_intent
        ? await db.campaign.findFirst({ where: { stripePaymentIntentId: session.payment_intent as string }, select: { id: true, name: true } })
        : null;

    if (!campaign) {
      console.error("[stripe/webhook] async_payment_failed: campaign not found", session.id);
      return NextResponse.json({ received: true });
    }

    await db.campaign.update({
      where: { id: campaign.id },
      data: {
        paymentStatus: "failed",
        isActive: false,
        suspendedAt: new Date(),
      },
    });

    // Send failure email
    if (userId) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
      if (user) {
        const { sendPaymentFailedEmail } = await import("@/lib/email");
        await sendPaymentFailedEmail({
          name: user.firstName,
          email: user.email,
          campaignName: campaign.name,
        });
      }
    }

    await createAuditLog({
      campaignId: campaign.id,
      userId: userId ?? undefined,
      action: "PAYMENT_FAILED",
      entityType: "campaign",
      entityId: campaign.id,
      details: { stripeSessionId: session.id },
    });

    console.log(`[stripe/webhook] Async payment failed: campaign=${campaign.id}`);
    return NextResponse.json({ received: true });
  }

  // ── checkout.session.completed ────────────────────────────────────────────

  if (!plan || !userId) {
    console.error("[stripe/webhook] Missing required metadata on session", session.id);
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  // Determine if this is an instant or delayed payment
  const isPaid = session.payment_status === "paid";
  const isDelayed = session.payment_status === "unpaid";

  if (!isPaid && !isDelayed) {
    return NextResponse.json({ received: true });
  }

  // ── New campaign: create from PendingCampaign ─────────────────────────────
  if (pendingId) {
    // Idempotency
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

    const existingMemberships = await db.campaignMembership.count({
      where: { userId: pending.userId, deletedAt: null },
    });
    const membershipRole = existingMemberships > 0 ? Role.campaign_manager : Role.candidate;

    // Payment due date: 7 calendar days from now for delayed payments
    const paymentDueDate = isDelayed ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;

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
          amountPaid: isPaid ? amountPaidDollars : 0,
          advanceVotingDates: [],
          ...(promoCodeId ? { promoCodeId } : {}),
          paymentStatus: isPaid ? "paid" : "pending",
          paymentDueDate,
          stripePaymentIntentId: (session.payment_intent as string) ?? null,
          memberships: {
            create: {
              userId: pending.userId,
              role: membershipRole,
            },
          },
        },
      });

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

      await tx.signatureConsentType.createMany({
        data: [
          { campaignId: newCampaign.id, label: "Lawn sign consent", sortOrder: 0 },
          { campaignId: newCampaign.id, label: "Volunteer consent",  sortOrder: 1 },
          { campaignId: newCampaign.id, label: "Petition",           sortOrder: 2 },
          { campaignId: newCampaign.id, label: "Other",              sortOrder: 3 },
        ],
      });

      await tx.campaignOverride.create({
        data: { campaignId: newCampaign.id, ...snapshotData },
      });

      await tx.pendingCampaign.delete({ where: { id: pendingId } });

      return newCampaign;
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
      campaignId: campaign.id,
      userId,
      action: "PLAN_PURCHASED",
      entityType: "campaign",
      entityId: campaign.id,
      details: {
        plan,
        stripeSessionId: session.id,
        amountCharged: amountPaidDollars,
        totalAmountPaid: amountPaidDollars,
        previousAmountPaid: 0,
        discountApplied: discountDollars,
        promoCodeId: promoCodeId ?? null,
        snapshotedAt: snapshotData.snapshotedAt,
        createdFromPending: pendingId,
        paymentStatus: isPaid ? "paid" : "pending",
      },
    });

    await createAuditLog({
      campaignId: campaign.id,
      userId,
      action: "CAMPAIGN_CREATED",
      entityType: "campaign",
      entityId: campaign.id,
      details: { name: pending.name, officeSought: pending.officeSought, municipality: pending.city },
    });

    const statusLabel = isPaid ? "paid" : "pending";
    console.log(`[stripe/webhook] Campaign created [${statusLabel}]: campaign=${campaign.id} plan=${plan} amount=${amountPaidDollars}`);
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

  const paymentDueDate = isDelayed ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      plan:          plan as PlanTier,
      planActivated: true,
      planLockedAt:  new Date(),
      amountPaid:    isPaid ? totalAmountPaid : previousPaid,
      ...(promoCodeId ? { promoCodeId } : {}),
      paymentStatus: isPaid ? "paid" : "pending",
      paymentDueDate,
      stripePaymentIntentId: (session.payment_intent as string) ?? null,
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
      paymentStatus:      isPaid ? "paid" : "pending",
    },
  });

  const statusLabel = isPaid ? "paid" : "pending";
  console.log(`[stripe/webhook] Plan activated [${statusLabel}]: campaign=${campaignId} plan=${plan} amount=${totalAmountPaid}`);
  return NextResponse.json({ received: true });
}
