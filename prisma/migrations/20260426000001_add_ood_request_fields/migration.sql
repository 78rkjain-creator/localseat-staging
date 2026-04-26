-- AlterTable: add out-of-district request tracking fields to people
ALTER TABLE "people" ADD COLUMN "outOfDistrictRequestedById" TEXT;
ALTER TABLE "people" ADD COLUMN "outOfDistrictRequestedAt" TIMESTAMP(3);
ALTER TABLE "people" ADD COLUMN "outOfDistrictRejectionReason" TEXT;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_outOfDistrictRequestedById_fkey"
  FOREIGN KEY ("outOfDistrictRequestedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for approval queue queries
CREATE INDEX "people_outOfDistrictApprovalStatus_idx" ON "people"("outOfDistrictApprovalStatus");
