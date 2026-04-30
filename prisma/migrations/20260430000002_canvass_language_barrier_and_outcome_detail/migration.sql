-- Add language_barrier value to CanvassOutcome enum
ALTER TYPE "CanvassOutcome" ADD VALUE 'language_barrier';

-- Add outcomeDetail column to canvass_responses (nullable, no backfill needed)
ALTER TABLE "canvass_responses" ADD COLUMN "outcomeDetail" TEXT;
