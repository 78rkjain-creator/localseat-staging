-- Add municipality fields to campaigns table
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "municipalityName" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "municipalityId"   TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "municipalityBoundary" JSONB;
