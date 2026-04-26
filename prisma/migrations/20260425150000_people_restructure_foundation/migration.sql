-- Extend ListSource enum to include 'team'.
-- ALTER TYPE ADD VALUE cannot be used in the same transaction as the new value,
-- so we use the rename-recreate pattern instead.
ALTER TYPE "ListSource" RENAME TO "ListSource_old";
CREATE TYPE "ListSource" AS ENUM ('voters_list', 'residents_list', 'manual', 'canvass', 'team');
ALTER TABLE "people" ALTER COLUMN "listSource" TYPE "ListSource" USING "listSource"::text::"ListSource";
DROP TYPE "ListSource_old";

-- New enum for out-of-district approval workflow
CREATE TYPE "OutOfDistrictApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- New columns on people
ALTER TABLE "people"
  ADD COLUMN "isOutOfDistrict"             BOOLEAN                       NOT NULL DEFAULT false,
  ADD COLUMN "outOfDistrictApprovalStatus" "OutOfDistrictApprovalStatus",
  ADD COLUMN "userId"                      TEXT,
  ADD COLUMN "needsDistrictClassification" BOOLEAN                       NOT NULL DEFAULT false;

-- FK: people.userId → users.id (nullable; set null on user delete)
ALTER TABLE "people"
  ADD CONSTRAINT "people_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique constraint: one person record per team member per campaign.
-- Partial index excludes NULL userId rows (regular voter/resident records).
CREATE UNIQUE INDEX "people_userId_campaignId_key"
  ON "people"("userId", "campaignId")
  WHERE "userId" IS NOT NULL;

-- Backfill: create a person record (listSource=team) for each active campaign membership.
-- Skips memberships that already have a matching person record in that campaign.
INSERT INTO "people" (
  "id", "campaignId", "firstName", "lastName", "email",
  "listSource", "userId", "wardStatus",
  "isOutOfDistrict", "needsDistrictClassification",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  cm."campaignId",
  u."firstName",
  u."lastName",
  u."email",
  'team'::"ListSource",
  u."id",
  'not_checked'::"WardStatus",
  false,
  false,
  NOW(),
  NOW()
FROM "campaign_memberships" cm
JOIN "users" u ON u."id" = cm."userId"
WHERE cm."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "people" p2
    WHERE p2."campaignId" = cm."campaignId"
      AND p2."userId" = u."id"
  );

-- Reclassify: flag existing voter/resident records whose ward status is unverified.
-- Team member records are excluded (they are classified separately).
UPDATE "people"
SET "needsDistrictClassification" = true
WHERE "wardStatus" = 'not_checked'::"WardStatus"
  AND "listSource" != 'team'::"ListSource"
  AND "deletedAt" IS NULL;
