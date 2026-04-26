INSERT INTO "people" ("id", "firstName", "lastName", "email", "campaignId", "listSource", "userId", "needsDistrictClassification", "isOutOfDistrict", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u."firstName", u."lastName", u."email", cm."campaignId", 'team', cm."userId", true, false, NOW(), NOW()
FROM "campaign_memberships" cm
JOIN "users" u ON u."id" = cm."userId"
WHERE cm."deletedAt" IS NULL
AND NOT EXISTS (SELECT 1 FROM "people" p WHERE p."userId" = cm."userId" AND p."campaignId" = cm."campaignId");
