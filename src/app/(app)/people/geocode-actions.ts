"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { geocodeAndClassifyAddress } from "@/lib/ward";
import { hasMinimumRole } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { Role } from "@prisma/client";

async function requireGeocodePermission() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeRole || !hasMinimumRole(activeRole as Role, Role.field_organizer)) {
    return { error: "Permission denied." } as const;
  }
  return { session, campaignId: activeCampaignId } as const;
}

// Returns IDs of all campaign persons that have an address but no lat/lng.
export async function getPersonsNeedingGeocode(): Promise<{
  ids?: string[];
  total?: number;
  error?: string;
}> {
  const auth = await requireGeocodePermission();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  const persons = await db.person.findMany({
    where: {
      campaignId,
      deletedAt: null,
      householdId: { not: null },
      household: { address: { lat: null } },
    },
    select: { id: true },
    orderBy: { lastName: "asc" },
  });

  return { ids: persons.map((p) => p.id), total: persons.length };
}

// Processes up to 20 person IDs sequentially.
// Sequential (not parallel) so Mapbox rate limit is respected.
const BATCH_SIZE = 20;

export async function bulkGeocodePersonsBatch(
  personIds: string[],
): Promise<{ processed: number; error?: string }> {
  const auth = await requireGeocodePermission();
  if ("error" in auth) return { error: auth.error, processed: 0 };
  const { campaignId, session } = auth;

  const capped = personIds.slice(0, BATCH_SIZE);

  const persons = await db.person.findMany({
    where: { id: { in: capped }, campaignId, deletedAt: null },
    select: { id: true, household: { select: { addressId: true } } },
  });

  let processed = 0;
  for (const person of persons) {
    const addressId = person.household?.addressId;
    if (!addressId) continue;
    await geocodeAndClassifyAddress(addressId, campaignId, person.id);
    processed++;
  }

  if (processed > 0) {
    await createAuditLog({
      campaignId,
      userId: session.user.id,
      action: "BULK_GEOCODE_BATCH",
      entityType: "campaign",
      entityId: campaignId,
      details: { processed },
    });
  }

  return { processed };
}
