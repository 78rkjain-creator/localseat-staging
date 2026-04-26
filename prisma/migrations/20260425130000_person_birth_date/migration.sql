-- Replace birthYear (Int) with birthDate (DateTime) on the people table.
-- Backfills existing rows using January 1 of the stored birth year.

ALTER TABLE "people" ADD COLUMN "birthDate" TIMESTAMP(3);

UPDATE "people"
SET "birthDate" = (MAKE_DATE("birthYear"::int, 1, 1))::timestamp
WHERE "birthYear" IS NOT NULL;

ALTER TABLE "people" DROP COLUMN "birthYear";
