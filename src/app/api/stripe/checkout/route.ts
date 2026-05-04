import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe, STRIPE_PRODUCTS } from "@/lib/stripe";
import { getTierPricing } from "@/app/onboarding/choose-plan/actions";
import { validatePromoCodeRecord } from "@/lib/promo-codes";
import type { PlanTier } from "@/lib/plan-limits";

const SELECTABLE_PLANS: PlanTier[] = ["bench", "chair", "podium", "stage", "arena"];

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { campaignId?: string; plan?: string; promoCode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { campaignId, plan, promoCode } = body;

  if (!campaignId || !plan) {
    return NextResponse.json({ error: "campaignId and plan are required" }, { status: 400 });
  }

  if (!SELECTABLE_PLANS.includes(plan as PlanTier)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
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
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, plan: true, planActivated: true, amountPaid: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const pricing = await getTierPricing();
  const tierInfo = pricing[plan];
  if (!tierInfo) {
    return NextResponse.json({ error: "Pricing not available" }, { status: 500 });
  }

  const effectivePrice = parseInt(tierInfo.salePrice ?? tierInfo.regularPrice, 10);

  const previousAmountPaid = campaign.amountPaid ?? 0;
  const isUpgrade = campaign.planActivated && previousAmountPaid > 0;
  const chargeAmount = isUpgrade
    ? Math.max(effectivePrice - previousAmountPaid, 0)
    : effectivePrice;

  if (chargeAmount === 0) {
    return NextResponse.json({ error: "No charge required for this upgrade" }, { status: 400 });
  }

  const productId = STRIPE_PRODUCTS[plan];
  if (!productId) {
    return NextResponse.json({ error: "Stripe product not configured for this plan" }, { status: 500 });
  }

  // Resolve promo code
  let resolvedPromo: { id: string; stripeCouponId: string } | null = null;
  if (promoCode) {
    const upperCode = promoCode.toUpperCase();
    const dbPromo = await db.promoCode.findUnique({
      where: { code: upperCode },
      select: { id: true, stripeCouponId: true, isActive: true, expiresAt: true, maxUses: true, usageCount: true },
    });

    if (dbPromo) {
      const check = validatePromoCodeRecord(dbPromo);
      if (!check.valid) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
      if (dbPromo.stripeCouponId) {
        resolvedPromo = { id: dbPromo.id, stripeCouponId: dbPromo.stripeCouponId };
      }
    }
  }

  const origin = request.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: chargeAmount * 100,
          product: productId,
        },
      },
    ],
    ...(resolvedPromo ? { discounts: [{ coupon: resolvedPromo.stripeCouponId }] } : {}),
    metadata: {
      campaignId,
      plan,
      userId:             session.user.id,
      previousPlan:       campaign.plan ?? "",
      previousAmountPaid: String(previousAmountPaid),
      isUpgrade:          String(isUpgrade),
      promoCodeId:        resolvedPromo?.id ?? "",
    },
    success_url: `${origin}/onboarding/choose-plan/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/onboarding/choose-plan?campaignId=${campaignId}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
