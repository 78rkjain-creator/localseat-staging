-- Add voter ID field to people table.
-- Unique per campaign so the same voter ID can exist across different campaigns.
ALTER TABLE "people" ADD COLUMN "voterId" TEXT;
CREATE UNIQUE INDEX "people_campaignId_voterId_key" ON "people"("campaignId", "voterId") WHERE "voterId" IS NOT NULL;
