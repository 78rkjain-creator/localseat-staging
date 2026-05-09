-- Add isGotvList flag to canvass_lists
ALTER TABLE "canvass_lists" ADD COLUMN "isGotvList" BOOLEAN NOT NULL DEFAULT false;
