import { getStripe } from "./stripe";
import { db } from "./db";

export async function createPromoCode(data: {
  code: string;
  referrerName: string;
  referrerEmail?: string;
  discountPercent: number;
  maxUses?: number;
  expiresAt?: Date;
}) {
  const stripe = getStripe();
  const upperCode = data.code.toUpperCase();

  const coupon = await stripe.coupons.create({
    percent_off: data.discountPercent,
    duration: "once",
    name: `${upperCode} (${data.referrerName})`,
  });

  await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: upperCode,
    max_redemptions: data.maxUses ?? undefined,
    expires_at: data.expiresAt
      ? Math.floor(data.expiresAt.getTime() / 1000)
      : undefined,
  });

  return db.promoCode.create({
    data: {
      code: upperCode,
      referrerName: data.referrerName,
      referrerEmail: data.referrerEmail,
      discountPercent: data.discountPercent,
      stripeCouponId: coupon.id,
      maxUses: data.maxUses,
      expiresAt: data.expiresAt,
    },
  });
}

export function validatePromoCodeRecord(code: {
  isActive: boolean;
  expiresAt: Date | null;
  maxUses: number | null;
  usageCount: number;
}): { valid: true } | { valid: false; error: string } {
  if (!code.isActive) return { valid: false, error: "This promo code is no longer active." };
  if (code.expiresAt && code.expiresAt < new Date()) return { valid: false, error: "This promo code has expired." };
  if (code.maxUses !== null && code.usageCount >= code.maxUses) return { valid: false, error: "This promo code has reached its usage limit." };
  return { valid: true };
}
