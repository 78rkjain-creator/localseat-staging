-- Add 'not_required' to OutOfDistrictApprovalStatus enum.
-- Uses rename-recreate pattern so the new value can be used in the same transaction.
ALTER TYPE "OutOfDistrictApprovalStatus" RENAME TO "OutOfDistrictApprovalStatus_old";
CREATE TYPE "OutOfDistrictApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'not_required');
ALTER TABLE "people"
  ALTER COLUMN "outOfDistrictApprovalStatus" TYPE "OutOfDistrictApprovalStatus"
  USING "outOfDistrictApprovalStatus"::text::"OutOfDistrictApprovalStatus";
DROP TYPE "OutOfDistrictApprovalStatus_old";

-- Backfill: team members don't need district approval — they are internal campaign staff.
UPDATE "people"
SET "outOfDistrictApprovalStatus" = 'not_required'
WHERE "listSource" = 'team'
  AND "outOfDistrictApprovalStatus" IS NULL;
