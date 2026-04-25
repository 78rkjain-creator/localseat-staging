-- CreateEnum
CREATE TYPE "SignStatus" AS ENUM ('to_be_installed', 'installed');

-- CreateEnum
CREATE TYPE "SignLocationType" AS ENUM ('residential', 'non_residential');

-- CreateTable
CREATE TABLE "signs" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "SignStatus" NOT NULL DEFAULT 'to_be_installed',
    "locationType" "SignLocationType" NOT NULL,
    "addressId" TEXT,
    "locationText" TEXT,
    "notes" TEXT,
    "addedById" TEXT NOT NULL,
    "installedById" TEXT,
    "installedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "signs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signs_campaignId_idx" ON "signs"("campaignId");

-- CreateIndex
CREATE INDEX "signs_deletedAt_idx" ON "signs"("deletedAt");

-- AddForeignKey
ALTER TABLE "signs" ADD CONSTRAINT "signs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signs" ADD CONSTRAINT "signs_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signs" ADD CONSTRAINT "signs_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signs" ADD CONSTRAINT "signs_installedById_fkey" FOREIGN KEY ("installedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
