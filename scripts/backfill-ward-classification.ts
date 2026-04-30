/**
 * One-time backfill: run ward classification for every Person with
 * wardStatus = not_checked AND householdId IS NOT NULL.
 *
 * These are records that have a geocoded address but never ran the
 * point-in-polygon ward check — typically persons imported before the
 * post-import classification step was added.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-ward-classification.ts --confirm
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-ward-classification.ts --confirm --campaignId=<id>
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-ward-classification.ts --confirm --all
 *
 * Without --confirm the script runs in dry-run mode (counts only, no writes).
 */

import { PrismaClient, WardStatus } from "@prisma/client";
import type { Polygon, MultiPolygon } from "geojson";

const db = new PrismaClient();

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const all = args.includes("--all");
const campaignIdArg = args.find((a) => a.startsWith("--campaignId="))?.split("=")[1];

if (!campaignIdArg && !all) {
  console.error("Pass --campaignId=<id> to target one campaign, or --all to process all campaigns.");
  process.exit(1);
}

// Inline point-in-polygon (ray casting) — avoids importing from src/lib/ward.ts
// which pulls in Next.js module resolution that breaks in plain ts-node.
function isPointInPolygonRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInWard(lat: number, lng: number, boundary: Polygon | MultiPolygon): boolean {
  if (boundary.type === "Polygon") {
    return isPointInPolygonRing(lat, lng, boundary.coordinates[0] as number[][]);
  }
  for (const poly of boundary.coordinates) {
    if (isPointInPolygonRing(lat, lng, poly[0] as number[][])) return true;
  }
  return false;
}

const BATCH_SIZE = 20;

async function processCampaign(campaignId: string) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, wardBoundary: true },
  });
  if (!campaign) {
    console.warn(`  Campaign ${campaignId} not found — skipping.`);
    return;
  }

  const wardBoundary = campaign.wardBoundary as unknown as Polygon | MultiPolygon | null;
  console.log(`\nCampaign: ${campaign.name} (${campaignId})`);

  const persons = await db.person.findMany({
    where: {
      campaignId,
      deletedAt: null,
      wardStatus: WardStatus.not_checked,
      householdId: { not: null },
    },
    select: {
      id: true,
      household: { select: { address: { select: { id: true, lat: true, lng: true } } } },
    },
  });

  console.log(`  Found ${persons.length} person(s) with wardStatus=not_checked`);
  if (persons.length === 0) return;
  if (!confirm) {
    console.log("  Dry-run mode — pass --confirm to apply changes.");
    return;
  }

  let classified = 0;
  let skippedNoLatLng = 0;
  let skippedNoBoundary = 0;

  for (let i = 0; i < persons.length; i += BATCH_SIZE) {
    const batch = persons.slice(i, i + BATCH_SIZE);
    for (const person of batch) {
      const addr = person.household?.address;
      if (!addr?.lat || !addr?.lng) {
        skippedNoLatLng++;
        continue;
      }
      if (!wardBoundary) {
        // No ward boundary — mark as inside (campaign doesn't use ward filtering)
        await db.person.update({
          where: { id: person.id },
          data: { wardStatus: WardStatus.inside, isOutOfDistrict: false },
        });
        classified++;
        continue;
      }
      const inside = isPointInWard(addr.lat, addr.lng, wardBoundary);
      await db.person.update({
        where: { id: person.id },
        data: {
          wardStatus: inside ? WardStatus.inside : WardStatus.outside,
          isOutOfDistrict: !inside,
          ...(inside ? {} : { outOfDistrictApprovalStatus: "pending" }),
        },
      });
      classified++;
    }
    process.stdout.write(`\r  Processed ${Math.min(i + BATCH_SIZE, persons.length)} / ${persons.length}`);
  }

  console.log(`\n  Done — classified: ${classified}, skipped (no lat/lng): ${skippedNoLatLng}, skipped (no boundary): ${skippedNoBoundary}`);
}

async function main() {
  if (!confirm) {
    console.log("DRY-RUN mode. Pass --confirm to apply changes.\n");
  }

  if (all) {
    const campaigns = await db.campaign.findMany({ select: { id: true } });
    for (const c of campaigns) {
      await processCampaign(c.id);
    }
  } else if (campaignIdArg) {
    await processCampaign(campaignIdArg);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  db.$disconnect();
  process.exit(1);
});
