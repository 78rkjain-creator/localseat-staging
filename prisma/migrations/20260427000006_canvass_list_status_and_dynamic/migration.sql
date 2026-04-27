-- CreateEnum
CREATE TYPE "CanvassListStatus" AS ENUM ('draft', 'pending_approval', 'active', 'archived');

-- AlterTable
ALTER TABLE "canvass_lists"
  ADD COLUMN "status"          "CanvassListStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "dynamicFilters"  JSONB,
  ADD COLUMN "lastRefreshedAt" TIMESTAMP(3);
