-- AlterTable
ALTER TABLE "demo_registrations" ADD COLUMN     "consented" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailedAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT;
