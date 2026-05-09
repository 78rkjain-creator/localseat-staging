-- GOTV system: vote target, GOTV mode, poll strikes, ride requests

-- Campaign: add vote target and GOTV mode toggle
ALTER TABLE "campaigns" ADD COLUMN "voteTarget" INTEGER;
ALTER TABLE "campaigns" ADD COLUMN "gotvModeEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Person: add ride request and voting plan time
ALTER TABLE "people" ADD COLUMN "needsRide" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "people" ADD COLUMN "votingPlanTime" TEXT;

-- Poll strike type enum
CREATE TYPE "PollStrikeType" AS ENUM ('advance_poll', 'election_day', 'mail_in');

-- Poll strikes table
CREATE TABLE "poll_strikes" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "strikeType" "PollStrikeType" NOT NULL DEFAULT 'election_day',
    "struckById" TEXT NOT NULL,
    "struckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_strikes_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "poll_strikes_campaignId_personId_key" ON "poll_strikes"("campaignId", "personId");
CREATE INDEX "poll_strikes_campaignId_idx" ON "poll_strikes"("campaignId");
CREATE INDEX "poll_strikes_personId_idx" ON "poll_strikes"("personId");

-- Foreign keys
ALTER TABLE "poll_strikes" ADD CONSTRAINT "poll_strikes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "poll_strikes" ADD CONSTRAINT "poll_strikes_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "poll_strikes" ADD CONSTRAINT "poll_strikes_struckById_fkey" FOREIGN KEY ("struckById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
