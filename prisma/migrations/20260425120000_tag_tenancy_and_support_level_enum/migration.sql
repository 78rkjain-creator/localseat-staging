-- Migration: tag_tenancy_and_support_level_enum
-- Applies two schema fixes in a single transaction-safe pass:
--   1. Tag tenant isolation  — adds campaignId FK, backfills, enforces NOT NULL
--   2. Person.supportLevel   — converts TEXT column to SupportLevel enum

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1: Tag tenancy
-- ═══════════════════════════════════════════════════════════════════════════════

-- Step 1: Add nullable campaignId so we can backfill before enforcing NOT NULL
ALTER TABLE "tags" ADD COLUMN "campaignId" TEXT;

-- Step 2a: Assign single-campaign tags directly
-- A tag used by people in exactly one campaign is simply stamped with that campaign.
UPDATE "tags" t
SET "campaignId" = sub."campaignId"
FROM (
  SELECT pt."tagId", p."campaignId"
  FROM "person_tags" pt
  JOIN "people" p ON p."id" = pt."personId"
  WHERE pt."deletedAt" IS NULL
  GROUP BY pt."tagId", p."campaignId"
  HAVING COUNT(DISTINCT p."campaignId") = 1
) sub
WHERE t."id" = sub."tagId"
  AND t."campaignId" IS NULL;

-- Step 2b: Handle multi-campaign tags
-- For each (tag, campaign) pair where the tag spans more than one campaign:
--   • First campaign encountered keeps the original tag row.
--   • Every additional campaign gets a new copy of the tag.
--   • PersonTag rows for each campaign are repointed to the correct tag copy.
DO $$
DECLARE
  r       RECORD;
  new_id  TEXT;
BEGIN
  FOR r IN
    SELECT DISTINCT pt."tagId", p."campaignId"
    FROM "person_tags" pt
    JOIN "people" p ON p."id" = pt."personId"
    WHERE pt."deletedAt" IS NULL
      AND pt."tagId" IN (
        SELECT pt2."tagId"
        FROM "person_tags" pt2
        JOIN "people" p2 ON p2."id" = pt2."personId"
        WHERE pt2."deletedAt" IS NULL
        GROUP BY pt2."tagId"
        HAVING COUNT(DISTINCT p2."campaignId") > 1
      )
    ORDER BY pt."tagId", p."campaignId"
  LOOP
    IF (SELECT "campaignId" FROM "tags" WHERE "id" = r."tagId") IS NULL THEN
      -- First campaign: assign in place
      UPDATE "tags" SET "campaignId" = r."campaignId" WHERE "id" = r."tagId";
    ELSE
      -- Additional campaign: duplicate the tag row
      new_id := gen_random_uuid()::text;
      INSERT INTO "tags" ("id", "name", "color", "campaignId", "deletedAt")
      SELECT new_id, "name", "color", r."campaignId", "deletedAt"
      FROM "tags" WHERE "id" = r."tagId";

      -- Repoint this campaign's PersonTag rows to the new copy
      UPDATE "person_tags" pt
      SET "tagId" = new_id
      FROM "people" p
      WHERE pt."personId" = p."id"
        AND pt."tagId"    = r."tagId"
        AND p."campaignId" = r."campaignId"
        AND pt."deletedAt" IS NULL;
    END IF;
  END LOOP;
END $$;

-- Step 2c: Delete orphan tags (referenced by no person_tag rows)
DELETE FROM "tags"
WHERE "campaignId" IS NULL;

-- Step 3: Enforce NOT NULL now that every surviving tag has a campaign
ALTER TABLE "tags" ALTER COLUMN "campaignId" SET NOT NULL;

-- Step 4: Add FK to campaigns
ALTER TABLE "tags" ADD CONSTRAINT "tags_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Replace global name uniqueness with per-campaign uniqueness
DROP INDEX "tags_name_key";
CREATE UNIQUE INDEX "tags_campaignId_name_key" ON "tags"("campaignId", "name");

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 2: Person.supportLevel TEXT → SupportLevel enum
-- ═══════════════════════════════════════════════════════════════════════════════

-- Step 6: Null out any freeform strings that have no matching enum member.
-- A NOTICE is raised so the migration output reports how many rows were affected.
DO $$
DECLARE
  nulled INT;
BEGIN
  UPDATE "people"
  SET "supportLevel" = NULL
  WHERE "supportLevel" IS NOT NULL
    AND "supportLevel" NOT IN (
      'strong_yes', 'soft_yes', 'undecided', 'soft_no', 'strong_no', 'not_home'
    );
  GET DIAGNOSTICS nulled = ROW_COUNT;
  IF nulled > 0 THEN
    RAISE NOTICE 'Nulled % person.supportLevel value(s) — unrecognised strings mapped to NULL.', nulled;
  END IF;
END $$;

-- Step 7: Change the column type from TEXT to the existing SupportLevel enum
-- (SupportLevel enum already exists in this DB from the canvass_responses table)
ALTER TABLE "people"
  ALTER COLUMN "supportLevel" TYPE "SupportLevel"
  USING "supportLevel"::"SupportLevel";
