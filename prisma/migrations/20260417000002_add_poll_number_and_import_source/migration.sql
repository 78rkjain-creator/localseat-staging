-- Add pollNumber and importSource columns to the people table.
-- pollNumber stores the electoral poll district number per voter row.
-- importSource stores a human-readable label for the import batch.

ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "pollNumber" TEXT;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "importSource" TEXT;
