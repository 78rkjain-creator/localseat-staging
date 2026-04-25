-- CreateEnum
CREATE TYPE "ListImportType" AS ENUM ('list', 'official_voters_list');

-- CreateEnum
CREATE TYPE "PersonListMembershipStatus" AS ENUM ('matched', 'created', 'pending_review', 'accepted');

-- CreateTable
CREATE TABLE "list_imports" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ListImportType" NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "list_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_list_memberships" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "listImportId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "PersonListMembershipStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_list_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "list_imports_campaignId_idx" ON "list_imports"("campaignId");

-- CreateIndex
CREATE INDEX "person_list_memberships_listImportId_idx" ON "person_list_memberships"("listImportId");

-- CreateIndex
CREATE INDEX "person_list_memberships_campaignId_idx" ON "person_list_memberships"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "person_list_memberships_personId_listImportId_key" ON "person_list_memberships"("personId", "listImportId");

-- AddForeignKey
ALTER TABLE "list_imports" ADD CONSTRAINT "list_imports_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_imports" ADD CONSTRAINT "list_imports_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_list_memberships" ADD CONSTRAINT "person_list_memberships_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_list_memberships" ADD CONSTRAINT "person_list_memberships_listImportId_fkey" FOREIGN KEY ("listImportId") REFERENCES "list_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_list_memberships" ADD CONSTRAINT "person_list_memberships_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
