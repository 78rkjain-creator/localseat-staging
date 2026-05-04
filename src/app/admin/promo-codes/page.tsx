import { db } from "@/lib/db";
import { PromoCodesClient } from "./promo-codes-client";

export const dynamic = "force-dynamic";

export default async function PromoCodesPage() {
  const codes = await db.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      referrerName: true,
      referrerEmail: true,
      discountPercent: true,
      stripeCouponId: true,
      isActive: true,
      maxUses: true,
      usageCount: true,
      totalRevenue: true,
      totalDiscounts: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Promo Codes</h1>
        <p className="text-sm text-slate-500 mt-1">Referral and promotional codes with Stripe coupon integration.</p>
      </div>

      <PromoCodesClient codes={codes} />
    </div>
  );
}
