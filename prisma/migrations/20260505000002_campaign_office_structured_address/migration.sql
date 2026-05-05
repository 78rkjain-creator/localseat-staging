-- AlterTable: add structured campaign office address fields
ALTER TABLE "campaigns" ADD COLUMN "officeAddressStreetNumber" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "officeAddressStreetName" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "officeAddressUnitNumber" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "officeAddressCity" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "officeAddressProvince" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "officeAddressPostalCode" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "officeAddressLat" DOUBLE PRECISION;
ALTER TABLE "campaigns" ADD COLUMN "officeAddressLng" DOUBLE PRECISION;
