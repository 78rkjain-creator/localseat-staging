-- AlterTable
ALTER TABLE "canvass_responses" ADD COLUMN     "competitorId" TEXT;

-- CreateTable
CREATE TABLE "campaign_competitors" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "campaign_competitors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_competitors_campaignId_idx" ON "campaign_competitors"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_competitors_deletedAt_idx" ON "campaign_competitors"("deletedAt");

-- CreateIndex
CREATE INDEX "canvass_responses_competitorId_idx" ON "canvass_responses"("competitorId");

-- AddForeignKey
ALTER TABLE "canvass_responses" ADD CONSTRAINT "canvass_responses_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "campaign_competitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_competitors" ADD CONSTRAINT "campaign_competitors_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
