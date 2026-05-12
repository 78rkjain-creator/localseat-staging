-- CreateEnum
CREATE TYPE "CampaignElectionType" AS ENUM ('municipal', 'provincial_nomination', 'provincial', 'federal_nomination', 'federal');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "campaignElectionType" "CampaignElectionType" NOT NULL DEFAULT 'municipal';
