-- CreateEnum (idempotent — type may already exist from a partial run)
DO $$ BEGIN
  CREATE TYPE "AddressChangeStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "address_change_requests" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "personId" TEXT NOT NULL,
    "affectedPersonIds" TEXT[],
    "oldAddressId" TEXT,
    "newAddressData" JSONB NOT NULL,
    "status" "AddressChangeStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "address_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "address_change_requests_campaignId_status_idx" ON "address_change_requests"("campaignId", "status");
CREATE INDEX IF NOT EXISTS "address_change_requests_personId_idx" ON "address_change_requests"("personId");

-- AddForeignKey (skip if already present)
DO $$ BEGIN
  ALTER TABLE "address_change_requests" ADD CONSTRAINT "address_change_requests_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "address_change_requests" ADD CONSTRAINT "address_change_requests_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "address_change_requests" ADD CONSTRAINT "address_change_requests_reviewedByUserId_fkey"
    FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "address_change_requests" ADD CONSTRAINT "address_change_requests_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
