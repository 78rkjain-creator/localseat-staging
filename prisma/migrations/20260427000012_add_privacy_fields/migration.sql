-- AlterTable: add data retention policy to campaigns
ALTER TABLE "campaigns" ADD COLUMN "dataRetentionMonths" INTEGER;

-- AlterTable: add anonymization timestamp to people
ALTER TABLE "people" ADD COLUMN "anonymizedAt" TIMESTAMP(3);
