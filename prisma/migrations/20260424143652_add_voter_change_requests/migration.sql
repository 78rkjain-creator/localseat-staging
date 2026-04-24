-- CreateTable
CREATE TABLE "voter_change_requests" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "personId" TEXT NOT NULL,
    "proposedChanges" JSONB NOT NULL,
    "currentSnapshot" JSONB,
    "status" "AddressChangeStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "voter_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voter_change_requests_campaignId_status_idx" ON "voter_change_requests"("campaignId", "status");

-- CreateIndex
CREATE INDEX "voter_change_requests_personId_idx" ON "voter_change_requests"("personId");

-- CreateIndex
CREATE INDEX "voter_change_requests_deletedAt_idx" ON "voter_change_requests"("deletedAt");

-- AddForeignKey
ALTER TABLE "voter_change_requests" ADD CONSTRAINT "voter_change_requests_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_change_requests" ADD CONSTRAINT "voter_change_requests_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_change_requests" ADD CONSTRAINT "voter_change_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voter_change_requests" ADD CONSTRAINT "voter_change_requests_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
