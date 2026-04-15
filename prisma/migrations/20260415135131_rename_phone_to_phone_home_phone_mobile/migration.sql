/*
  Warnings:

  - You are about to drop the column `ward` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `donors` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `people` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "ward",
ADD COLUMN     "ballotName" TEXT,
ADD COLUMN     "electionDate" TIMESTAMP(3),
ADD COLUMN     "municipality" TEXT,
ADD COLUMN     "officeSought" TEXT,
ADD COLUMN     "wards" TEXT[];

-- AlterTable
ALTER TABLE "donors" DROP COLUMN "phone",
ADD COLUMN     "phoneHome" TEXT,
ADD COLUMN     "phoneMobile" TEXT;

-- AlterTable
ALTER TABLE "people" DROP COLUMN "phone",
ADD COLUMN     "phoneHome" TEXT,
ADD COLUMN     "phoneMobile" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "phone",
ADD COLUMN     "phoneHome" TEXT,
ADD COLUMN     "phoneMobile" TEXT;
