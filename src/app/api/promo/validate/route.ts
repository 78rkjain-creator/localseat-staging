import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validatePromoCodeRecord } from "@/lib/promo-codes";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ valid: false, error: "No code provided." }, { status: 400 });
  }

  const record = await db.promoCode.findUnique({
    where: { code },
    select: {
      code: true,
      referrerName: true,
      discountPercent: true,
      isActive: true,
      expiresAt: true,
      maxUses: true,
      usageCount: true,
    },
  });

  if (!record) {
    return NextResponse.json({ valid: false, error: "Promo code not found." });
  }

  const check = validatePromoCodeRecord(record);
  if (!check.valid) {
    return NextResponse.json({ valid: false, error: check.error });
  }

  return NextResponse.json({
    valid: true,
    code: record.code,
    discountPercent: record.discountPercent,
    referrerName: record.referrerName,
  });
}
