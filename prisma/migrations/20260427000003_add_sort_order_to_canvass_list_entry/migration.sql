-- Add sortOrder to canvass_list_entries for route optimization
ALTER TABLE "canvass_list_entries" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
