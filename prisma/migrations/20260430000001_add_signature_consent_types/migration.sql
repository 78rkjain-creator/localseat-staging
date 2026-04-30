-- CreateTable
CREATE TABLE "signature_consent_types" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "signature_consent_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_consents" (
    "id" TEXT NOT NULL,
    "signatureId" TEXT NOT NULL,
    "consentTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signature_consent_types_campaignId_idx" ON "signature_consent_types"("campaignId");

-- CreateIndex
CREATE INDEX "signature_consents_signatureId_idx" ON "signature_consents"("signatureId");

-- CreateIndex
CREATE INDEX "signature_consents_consentTypeId_idx" ON "signature_consents"("consentTypeId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "signature_consents_signatureId_consentTypeId_key" ON "signature_consents"("signatureId", "consentTypeId");

-- AddForeignKey
ALTER TABLE "signature_consent_types" ADD CONSTRAINT "signature_consent_types_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_consents" ADD CONSTRAINT "signature_consents_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "signature_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_consents" ADD CONSTRAINT "signature_consents_consentTypeId_fkey" FOREIGN KEY ("consentTypeId") REFERENCES "signature_consent_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed four default consent types for every existing campaign
INSERT INTO "signature_consent_types" ("id", "campaignId", "label", "sortOrder", "createdAt")
SELECT
    gen_random_uuid()::text,
    c."id",
    v.label,
    v.sort_order,
    NOW()
FROM "campaigns" c
CROSS JOIN (VALUES
    ('Lawn sign consent', 0),
    ('Volunteer consent',  1),
    ('Petition',           2),
    ('Other',              3)
) AS v(label, sort_order);

-- Backfill join rows for existing signature records using purpose → label mapping
INSERT INTO "signature_consents" ("id", "signatureId", "consentTypeId", "createdAt")
SELECT
    gen_random_uuid()::text,
    sr."id",
    sct."id",
    NOW()
FROM "signature_records" sr
JOIN "signature_consent_types" sct
  ON sct."campaignId" = sr."campaignId"
  AND sct."deletedAt" IS NULL
  AND (
      (sr."purpose" = 'lawn_sign_consent' AND sct."label" = 'Lawn sign consent')
   OR (sr."purpose" = 'volunteer_consent'  AND sct."label" = 'Volunteer consent')
   OR (sr."purpose" = 'petition'           AND sct."label" = 'Petition')
   OR (sr."purpose" = 'other'              AND sct."label" = 'Other')
   OR (sr."purpose" NOT IN ('lawn_sign_consent','volunteer_consent','petition','other') AND sct."label" = 'Other')
  )
ON CONFLICT DO NOTHING;
