-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('starter', 'campaign', 'election', 'demo');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "amountPaid" INTEGER,
ADD COLUMN     "plan" "PlanTier" NOT NULL DEFAULT 'starter',
ADD COLUMN     "planActivated" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "planLockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_overrides" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "canvasserLimit" INTEGER,
    "constituentLimit" INTEGER,
    "extraCanvassers" INTEGER,
    "coChairLimit" INTEGER,
    "fieldOrganizerLimit" INTEGER,
    "donorTrackingEnabled" BOOLEAN,
    "notesInternal" TEXT,
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_overrides_campaignId_key" ON "campaign_overrides"("campaignId");

-- AddForeignKey
ALTER TABLE "campaign_overrides" ADD CONSTRAINT "campaign_overrides_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
