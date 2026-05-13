-- CreateTable
CREATE TABLE "pending_campaigns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ballotName" TEXT,
    "officeSought" TEXT,
    "municipality" TEXT,
    "municipalityName" TEXT,
    "municipalityId" TEXT,
    "municipalityBoundary" JSONB,
    "wards" TEXT[],
    "city" TEXT NOT NULL DEFAULT '',
    "province" TEXT NOT NULL DEFAULT 'ON',
    "year" INTEGER NOT NULL,
    "electionDate" TIMESTAMP(3),
    "campaignElectionType" "CampaignElectionType" NOT NULL DEFAULT 'municipal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_campaigns_userId_idx" ON "pending_campaigns"("userId");

-- CreateIndex
CREATE INDEX "pending_campaigns_expiresAt_idx" ON "pending_campaigns"("expiresAt");

-- AddForeignKey
ALTER TABLE "pending_campaigns" ADD CONSTRAINT "pending_campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
