-- Add data_supplier to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'data_supplier';

-- Add company fields to campaign_memberships
ALTER TABLE "campaign_memberships" ADD COLUMN IF NOT EXISTS "company" TEXT;
ALTER TABLE "campaign_memberships" ADD COLUMN IF NOT EXISTS "companyPhone" TEXT;
ALTER TABLE "campaign_memberships" ADD COLUMN IF NOT EXISTS "companyEmail" TEXT;

-- CreateTable: data_imports
CREATE TABLE IF NOT EXISTS "data_imports" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "validCount" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rawData" JSONB NOT NULL,
    "errors" JSONB,
    "supplierNote" TEXT,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable: supplier_acknowledgements
CREATE TABLE IF NOT EXISTS "supplier_acknowledgements" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "signedById" TEXT NOT NULL,
    "signedName" TEXT NOT NULL,
    "signedEmail" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "supplierEmail" TEXT NOT NULL,
    "supplierCompany" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "data_imports_campaignId_idx" ON "data_imports"("campaignId");
CREATE INDEX IF NOT EXISTS "data_imports_uploadedById_idx" ON "data_imports"("uploadedById");
CREATE INDEX IF NOT EXISTS "supplier_acknowledgements_campaignId_idx" ON "supplier_acknowledgements"("campaignId");

-- Handle pending unique indexes on people (may already exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='people' AND indexname='people_userId_campaignId_key') THEN
    CREATE UNIQUE INDEX "people_userId_campaignId_key" ON "people"("userId", "campaignId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='people' AND indexname='people_campaignId_voterId_key') THEN
    CREATE UNIQUE INDEX "people_campaignId_voterId_key" ON "people"("campaignId", "voterId");
  END IF;
END $$;

-- Handle support_access_grants FK constraints (may already exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='support_access_grants_campaignId_fkey') THEN
    ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='support_access_grants_requestedBy_fkey') THEN
    ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='support_access_grants_approvedBy_fkey') THEN
    ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='support_access_grants_revokedBy_fkey') THEN
    ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_revokedBy_fkey" FOREIGN KEY ("revokedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='support_access_grants_deniedBy_fkey') THEN
    ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_deniedBy_fkey" FOREIGN KEY ("deniedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Rename support_access_grants index if needed
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='support_access_grants' AND indexname='support_access_grants_campaign_expires') THEN
    ALTER INDEX "support_access_grants_campaign_expires" RENAME TO "support_access_grants_campaignId_expiresAt_idx";
  END IF;
END $$;

-- AddForeignKey: data_imports
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='data_imports_campaignId_fkey') THEN
    ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='data_imports_uploadedById_fkey') THEN
    ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='data_imports_reviewedById_fkey') THEN
    ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: supplier_acknowledgements
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='supplier_acknowledgements_campaignId_fkey') THEN
    ALTER TABLE "supplier_acknowledgements" ADD CONSTRAINT "supplier_acknowledgements_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='supplier_acknowledgements_signedById_fkey') THEN
    ALTER TABLE "supplier_acknowledgements" ADD CONSTRAINT "supplier_acknowledgements_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
