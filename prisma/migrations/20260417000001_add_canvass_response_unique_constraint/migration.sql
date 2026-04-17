-- Add unique constraint on (assignmentId, personId) to prevent duplicate canvass responses.
-- The upsert in saveCanvassResponse relies on this constraint for idempotent retry support.
CREATE UNIQUE INDEX IF NOT EXISTS "canvass_responses_assignmentId_personId_key"
  ON "canvass_responses"("assignmentId", "personId");
