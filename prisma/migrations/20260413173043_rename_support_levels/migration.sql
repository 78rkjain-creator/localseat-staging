/*
  Warnings:

  - The values [strong_support,lean_support,lean_against,strong_against,unknown] on the enum `SupportLevel` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SupportLevel_new" AS ENUM ('strong_yes', 'soft_yes', 'undecided', 'soft_no', 'strong_no', 'not_home');
ALTER TABLE "canvass_responses" ALTER COLUMN "supportLevel" TYPE "SupportLevel_new" USING ("supportLevel"::text::"SupportLevel_new");
ALTER TYPE "SupportLevel" RENAME TO "SupportLevel_old";
ALTER TYPE "SupportLevel_new" RENAME TO "SupportLevel";
DROP TYPE "SupportLevel_old";
COMMIT;
