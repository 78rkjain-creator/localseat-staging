-- Add 8 new feature override columns to campaign_overrides
ALTER TABLE campaign_overrides
  ADD COLUMN IF NOT EXISTS "eventsEnabled"            BOOLEAN,
  ADD COLUMN IF NOT EXISTS "surveysEnabled"           BOOLEAN,
  ADD COLUMN IF NOT EXISTS "digitalSignaturesEnabled" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "customFieldsEnabled"      BOOLEAN,
  ADD COLUMN IF NOT EXISTS "signTrackingEnabled"      BOOLEAN,
  ADD COLUMN IF NOT EXISTS "contactMapEnabled"        BOOLEAN,
  ADD COLUMN IF NOT EXISTS "reportsEnabled"           BOOLEAN,
  ADD COLUMN IF NOT EXISTS "canvassScriptEnabled"     BOOLEAN;

-- Add 8 new snapshot columns to campaign_overrides
ALTER TABLE campaign_overrides
  ADD COLUMN IF NOT EXISTS "snapshotEvents"              BOOLEAN,
  ADD COLUMN IF NOT EXISTS "snapshotSurveys"             BOOLEAN,
  ADD COLUMN IF NOT EXISTS "snapshotDigitalSignatures"   BOOLEAN,
  ADD COLUMN IF NOT EXISTS "snapshotCustomFields"        BOOLEAN,
  ADD COLUMN IF NOT EXISTS "snapshotSignTracking"        BOOLEAN,
  ADD COLUMN IF NOT EXISTS "snapshotContactMap"          BOOLEAN,
  ADD COLUMN IF NOT EXISTS "snapshotReports"             BOOLEAN,
  ADD COLUMN IF NOT EXISTS "snapshotCanvassScript"       BOOLEAN;
