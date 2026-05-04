-- CreateTable
CREATE TABLE "promo_codes" (
    "id"              TEXT NOT NULL,
    "code"            TEXT NOT NULL,
    "referrerName"    TEXT NOT NULL,
    "referrerEmail"   TEXT,
    "discountPercent" INTEGER NOT NULL DEFAULT 5,
    "stripeCouponId"  TEXT,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "maxUses"         INTEGER,
    "usageCount"      INTEGER NOT NULL DEFAULT 0,
    "totalRevenue"    INTEGER NOT NULL DEFAULT 0,
    "totalDiscounts"  INTEGER NOT NULL DEFAULT 0,
    "expiresAt"       TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "promoCodeId" TEXT;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_promoCodeId_fkey"
    FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
