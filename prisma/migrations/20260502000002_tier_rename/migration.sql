-- Rename PlanTier enum values
ALTER TYPE "PlanTier" RENAME VALUE 'starter'  TO 'bench';
ALTER TYPE "PlanTier" RENAME VALUE 'campaign' TO 'chair';
ALTER TYPE "PlanTier" RENAME VALUE 'election' TO 'podium';

-- Add new PlanTier values
ALTER TYPE "PlanTier" ADD VALUE 'stage';
ALTER TYPE "PlanTier" ADD VALUE 'arena';

-- Update Campaign.plan column default
ALTER TABLE "campaigns" ALTER COLUMN "plan" SET DEFAULT 'bench';

-- Add tag / custom-field limit columns to campaign_overrides
ALTER TABLE "campaign_overrides" ADD COLUMN IF NOT EXISTS "tagLimit"                 INTEGER;
ALTER TABLE "campaign_overrides" ADD COLUMN IF NOT EXISTS "customFieldLimit"         INTEGER;
ALTER TABLE "campaign_overrides" ADD COLUMN IF NOT EXISTS "snapshotTagLimit"         INTEGER;
ALTER TABLE "campaign_overrides" ADD COLUMN IF NOT EXISTS "snapshotCustomFieldLimit" INTEGER;
