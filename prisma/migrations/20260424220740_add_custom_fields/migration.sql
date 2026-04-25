-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "customFields" JSONB;

-- AlterTable
ALTER TABLE "people" ADD COLUMN     "customFieldValues" JSONB;
