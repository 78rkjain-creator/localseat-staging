CREATE TABLE IF NOT EXISTS support_access_grants (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES campaigns(id),
  requested_by TEXT NOT NULL REFERENCES users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_note TEXT,
  approved_by  TEXT REFERENCES users(id),
  approved_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  revoked_by   TEXT REFERENCES users(id),
  denied_at    TIMESTAMPTZ,
  denied_by    TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS support_access_grants_campaign_expires
  ON support_access_grants(campaign_id, expires_at);