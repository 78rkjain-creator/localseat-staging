-- Do-not-contact flag on people
ALTER TABLE "people" ADD COLUMN "doNotContact" BOOLEAN NOT NULL DEFAULT false;

-- Campaign logo URL
ALTER TABLE "campaigns" ADD COLUMN "logoUrl" TEXT;

-- Per-list survey assignment
ALTER TABLE "canvass_lists" ADD COLUMN "surveyId" TEXT;
ALTER TABLE "canvass_lists" ADD CONSTRAINT "canvass_lists_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
