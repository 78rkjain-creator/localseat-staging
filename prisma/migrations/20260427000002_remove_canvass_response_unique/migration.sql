-- Allow multiple responses per person per assignment (re-visits)
-- Previously a unique constraint prevented recording more than one visit per door.
DROP INDEX IF EXISTS "canvass_responses_assignmentId_personId_key";
