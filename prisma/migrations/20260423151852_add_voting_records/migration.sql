-- CreateEnum
CREATE TYPE "ElectionType" AS ENUM ('federal', 'provincial', 'municipal');

-- CreateTable
CREATE TABLE "voting_records" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "electionType" "ElectionType" NOT NULL,
    "electionYear" INTEGER NOT NULL,
    "electionName" TEXT,
    "participated" BOOLEAN NOT NULL DEFAULT false,
    "partySupport" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "voting_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voting_records_campaignId_idx" ON "voting_records"("campaignId");

-- CreateIndex
CREATE INDEX "voting_records_personId_idx" ON "voting_records"("personId");

-- CreateIndex
CREATE INDEX "voting_records_deletedAt_idx" ON "voting_records"("deletedAt");

-- AddForeignKey
ALTER TABLE "voting_records" ADD CONSTRAINT "voting_records_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voting_records" ADD CONSTRAINT "voting_records_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
