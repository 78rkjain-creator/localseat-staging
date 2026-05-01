CREATE TABLE IF NOT EXISTS support_access_grants (
  "id"          TEXT PRIMARY KEY,
  "campaignId"  TEXT NOT NULL REFERENCES campaigns(id),
  "requestedBy" TEXT NOT NULL REFERENCES users(id),
  "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "requestNote" TEXT,
  "approvedBy"  TEXT REFERENCES users(id),
  "approvedAt"  TIMESTAMPTZ,
  "expiresAt"   TIMESTAMPTZ,
  "revokedAt"   TIMESTAMPTZ,
  "revokedBy"   TEXT REFERENCES users(id),
  "deniedAt"    TIMESTAMPTZ,
  "deniedBy"    TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS support_access_grants_campaign_expires
  ON support_access_grants("campaignId", "expiresAt");
