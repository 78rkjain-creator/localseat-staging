-- CreateEnum
CREATE TYPE "WardStatus" AS ENUM ('not_checked', 'inside', 'outside', 'outside_accepted', 'pending_review');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "wardBoundary" JSONB,
ADD COLUMN     "wardBoundarySetAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "people" ADD COLUMN     "wardStatus" "WardStatus" NOT NULL DEFAULT 'not_checked';
