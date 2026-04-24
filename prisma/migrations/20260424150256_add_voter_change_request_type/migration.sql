-- DropForeignKey
ALTER TABLE "voter_change_requests" DROP CONSTRAINT "voter_change_requests_personId_fkey";

-- AlterTable
ALTER TABLE "voter_change_requests" ADD COLUMN     "requestType" TEXT DEFAULT 'field_edit',
ALTER COLUMN "personId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "voter_change_requests" ADD CONSTRAINT "voter_change_requests_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
