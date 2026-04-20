-- AlterTable
ALTER TABLE "canvass_lists" ADD COLUMN     "turfCreatedAt" TIMESTAMP(3),
ADD COLUMN     "turfPolygon" JSONB;
