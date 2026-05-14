-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('paid', 'pending', 'failed', 'suspended');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'paid';
ALTER TABLE "campaigns" ADD COLUMN "paymentDueDate" TIMESTAMP(3);
ALTER TABLE "campaigns" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "paymentWarningsSent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN "suspendedAt" TIMESTAMP(3);
