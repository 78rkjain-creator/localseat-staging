-- CreateIndex
CREATE INDEX "audit_logs_campaignId_idx" ON "audit_logs"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_memberships_campaignId_idx" ON "campaign_memberships"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_memberships_userId_idx" ON "campaign_memberships"("userId");

-- CreateIndex
CREATE INDEX "canvass_assignments_canvassListId_idx" ON "canvass_assignments"("canvassListId");

-- CreateIndex
CREATE INDEX "canvass_assignments_canvasserId_idx" ON "canvass_assignments"("canvasserId");

-- CreateIndex
CREATE INDEX "canvass_responses_assignmentId_idx" ON "canvass_responses"("assignmentId");

-- CreateIndex
CREATE INDEX "canvass_responses_personId_idx" ON "canvass_responses"("personId");

-- CreateIndex
CREATE INDEX "donors_campaignId_idx" ON "donors"("campaignId");

-- CreateIndex
CREATE INDEX "donors_linkedPersonId_idx" ON "donors"("linkedPersonId");

-- CreateIndex
CREATE INDEX "notes_personId_idx" ON "notes"("personId");

-- CreateIndex
CREATE INDEX "outreach_logs_campaignId_idx" ON "outreach_logs"("campaignId");

-- CreateIndex
CREATE INDEX "outreach_logs_personId_idx" ON "outreach_logs"("personId");

-- CreateIndex
CREATE INDEX "people_campaignId_deletedAt_idx" ON "people"("campaignId", "deletedAt");

-- CreateIndex
CREATE INDEX "people_lastName_idx" ON "people"("lastName");

-- CreateIndex
CREATE INDEX "people_email_idx" ON "people"("email");

-- CreateIndex
CREATE INDEX "people_supportLevel_idx" ON "people"("supportLevel");

-- CreateIndex
CREATE INDEX "tasks_campaignId_idx" ON "tasks"("campaignId");

-- CreateIndex
CREATE INDEX "tasks_assignedTo_idx" ON "tasks"("assignedTo");
