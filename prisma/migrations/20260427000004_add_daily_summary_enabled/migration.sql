-- Add dailySummaryEnabled to campaigns for scheduled report opt-in
ALTER TABLE "campaigns" ADD COLUMN "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT false;
