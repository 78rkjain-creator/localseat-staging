-- AlterTable: add seriesId to events
ALTER TABLE "events" ADD COLUMN "seriesId" TEXT;

-- CreateIndex for seriesId
CREATE INDEX "events_seriesId_idx" ON "events"("seriesId");

-- AlterTable: add advanceVotingDates to campaigns
ALTER TABLE "campaigns" ADD COLUMN "advanceVotingDates" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[];
