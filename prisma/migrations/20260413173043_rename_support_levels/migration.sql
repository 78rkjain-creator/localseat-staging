-- NULL out any rows that carry old enum values which have no equivalent in the new enum.
-- This is safe in dev — the seed will repopulate everything with correct values.
UPDATE "canvass_responses"
SET "supportLevel" = NULL
WHERE "supportLevel"::text IN (
  'strong_support', 'lean_support', 'lean_against', 'strong_against', 'unknown'
);

-- AlterEnum: replace old SupportLevel values with new ones.
BEGIN;
CREATE TYPE "SupportLevel_new" AS ENUM ('strong_yes', 'soft_yes', 'undecided', 'soft_no', 'strong_no', 'not_home');
ALTER TABLE "canvass_responses" ALTER COLUMN "supportLevel" TYPE "SupportLevel_new" USING ("supportLevel"::text::"SupportLevel_new");
ALTER TYPE "SupportLevel" RENAME TO "SupportLevel_old";
ALTER TYPE "SupportLevel_new" RENAME TO "SupportLevel";
DROP TYPE "SupportLevel_old";
COMMIT;
