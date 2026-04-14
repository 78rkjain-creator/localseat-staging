/*
  Warnings:

  - You are about to drop the `donor_records` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DonorStatus" AS ENUM ('interested', 'pledged', 'received');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'cheque', 'e_transfer', 'other');

-- DropForeignKey
ALTER TABLE "donor_records" DROP CONSTRAINT "donor_records_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "donor_records" DROP CONSTRAINT "donor_records_personId_fkey";

-- DropTable
DROP TABLE "donor_records";

-- CreateTable
CREATE TABLE "donors" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "amount" DECIMAL(10,2),
    "donationDate" TIMESTAMP(3),
    "status" "DonorStatus" NOT NULL DEFAULT 'interested',
    "paymentMethod" "PaymentMethod",
    "thankYouSent" BOOLEAN NOT NULL DEFAULT false,
    "thankYouDate" TIMESTAMP(3),
    "notes" TEXT,
    "linkedPersonId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "donors_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "donors" ADD CONSTRAINT "donors_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donors" ADD CONSTRAINT "donors_linkedPersonId_fkey" FOREIGN KEY ("linkedPersonId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donors" ADD CONSTRAINT "donors_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
