-- AlterTable
ALTER TABLE "campaign_memberships" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "canvass_assignments" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "canvass_list_entries" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "person_tags" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "volunteer_shift_attendees" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "campaign_memberships_deletedAt_idx" ON "campaign_memberships"("deletedAt");

-- CreateIndex
CREATE INDEX "campaigns_deletedAt_idx" ON "campaigns"("deletedAt");

-- CreateIndex
CREATE INDEX "canvass_assignments_deletedAt_idx" ON "canvass_assignments"("deletedAt");

-- CreateIndex
CREATE INDEX "canvass_list_entries_deletedAt_idx" ON "canvass_list_entries"("deletedAt");

-- CreateIndex
CREATE INDEX "notes_deletedAt_idx" ON "notes"("deletedAt");

-- CreateIndex
CREATE INDEX "person_tags_deletedAt_idx" ON "person_tags"("deletedAt");

-- CreateIndex
CREATE INDEX "tags_deletedAt_idx" ON "tags"("deletedAt");

-- CreateIndex
CREATE INDEX "tasks_deletedAt_idx" ON "tasks"("deletedAt");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "volunteer_shift_attendees_deletedAt_idx" ON "volunteer_shift_attendees"("deletedAt");
