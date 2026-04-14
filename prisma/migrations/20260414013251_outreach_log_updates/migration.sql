/*
  Warnings:

  - You are about to drop the column `method` on the `outreach_logs` table. All the data in the column will be lost.
  - Added the required column `channel` to the `outreach_logs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OutreachChannel" AS ENUM ('door_knock', 'phone_call', 'email', 'text_message', 'in_person', 'other');

-- DropForeignKey
ALTER TABLE "outreach_logs" DROP CONSTRAINT "outreach_logs_userId_fkey";

-- AlterTable
-- Add channel as nullable first so the statement succeeds on non-empty tables.
ALTER TABLE "outreach_logs" DROP COLUMN "method",
ADD COLUMN     "channel" "OutreachChannel",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "phoneType" TEXT,
ADD COLUMN     "phonedBy" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- Backfill: default any existing null channel values to 'door_knock'.
UPDATE "outreach_logs" SET "channel" = 'door_knock' WHERE "channel" IS NULL;

-- Now it is safe to enforce NOT NULL.
ALTER TABLE "outreach_logs" ALTER COLUMN "channel" SET NOT NULL;

-- DropEnum
DROP TYPE "OutreachMethod";

-- AddForeignKey
ALTER TABLE "outreach_logs" ADD CONSTRAINT "outreach_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
