"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPromoCode } from "@/lib/promo-codes";

async function requireSuperUser() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  const { platformRole } = session.user;
  if (platformRole !== "super_user" && platformRole !== "super_admin") {
    return { error: "Forbidden." } as const;
  }
  return { ok: true } as const;
}

export async function createPromoCodeAction(data: {
  code: string;
  referrerName: string;
  referrerEmail?: string;
  discountPercent: number;
  maxUses?: number;
  expiresAt?: string;
}): Promise<{ error?: string; id?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  const code = data.code.trim().toUpperCase();
  if (!code) return { error: "Code is required." };
  if (!/^[A-Z0-9_-]+$/.test(code)) return { error: "Code may only contain letters, numbers, hyphens, and underscores." };
  if (!data.referrerName.trim()) return { error: "Referrer name is required." };
  if (data.discountPercent < 1 || data.discountPercent > 100) return { error: "Discount must be between 1 and 100." };

  const existing = await db.promoCode.findUnique({ where: { code } });
  if (existing) return { error: "A promo code with that code already exists." };

  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : undefined;

  try {
    const stripeEnabled = process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true";
    let record;

    if (stripeEnabled) {
      record = await createPromoCode({
        code,
        referrerName: data.referrerName.trim(),
        referrerEmail: data.referrerEmail?.trim() || undefined,
        discountPercent: data.discountPercent,
        maxUses: data.maxUses || undefined,
        expiresAt,
      });
    } else {
      record = await db.promoCode.create({
        data: {
          code,
          referrerName: data.referrerName.trim(),
          referrerEmail: data.referrerEmail?.trim() || undefined,
          discountPercent: data.discountPercent,
          maxUses: data.maxUses || undefined,
          expiresAt,
        },
      });
    }

    revalidatePath("/admin/promo-codes");
    return { id: record.id };
  } catch (err) {
    console.error("[promo-codes/create]", err);
    return { error: "Failed to create promo code. Check server logs." };
  }
}

export async function togglePromoCodeAction(
  id: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  await db.promoCode.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/promo-codes");
  return {};
}
