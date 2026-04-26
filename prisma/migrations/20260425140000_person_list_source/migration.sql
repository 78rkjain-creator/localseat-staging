-- CreateEnum
CREATE TYPE "ListSource" AS ENUM ('voters_list', 'residents_list', 'manual', 'canvass');

-- AddColumns (nullable first so the backfill below can run without a default)
ALTER TABLE "people" ADD COLUMN "listSource"         "ListSource";
ALTER TABLE "people" ADD COLUMN "includeInWalkLists" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: confirmed voters from official voters list
UPDATE "people" SET "listSource" = 'voters_list' WHERE "isConfirmedVoter" = true;

-- Backfill: anyone linked to a list import (residents list, telephone list, etc.)
-- Note: this intentionally runs after the voters_list pass so OVL-matched records
-- keep voters_list even if they also appear in a list import.
UPDATE "people" p
SET    "listSource" = 'residents_list'
WHERE  p."listSource" IS NULL
  AND  EXISTS (
         SELECT 1
         FROM   "person_list_memberships" plm
         WHERE  plm."personId" = p.id
       );

-- Backfill: everything else becomes manual.
-- canvass-created records cannot be reliably detected retroactively without
-- an audit-log scan, so they are also classified as manual here.
UPDATE "people" SET "listSource" = 'manual' WHERE "listSource" IS NULL;

-- Make listSource NOT NULL now that every row has a value
ALTER TABLE "people" ALTER COLUMN "listSource" SET NOT NULL;
