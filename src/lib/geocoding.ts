import { db } from "@/lib/db";

const MAPBOX_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const BATCH_SIZE = 10;
const BETWEEN_BATCHES_MS = 600;

// ── geocodeAddress ─────────────────────────────────────────────────────────
// Resolves coordinates for a single Address record.
// Returns cached lat/lng immediately if already set.
// Returns null on any failure — never throws.

export async function geocodeAddress(
  addressId: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const address = await db.address.findUnique({ where: { id: addressId } });
    if (!address) return null;

    // Already geocoded — return cached values
    if (address.lat !== null && address.lng !== null) {
      return { lat: address.lat, lng: address.lng };
    }

    const query = [
      address.streetNumber,
      address.streetName,
      address.city,
      address.province,
      address.postalCode,
      "Canada",
    ].join(", ");

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.warn("[geocoding] NEXT_PUBLIC_MAPBOX_TOKEN is not set");
      return null;
    }

    const url =
      `${MAPBOX_BASE}/${encodeURIComponent(query)}.json` +
      `?access_token=${token}&country=ca&limit=1`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[geocoding] Mapbox returned ${res.status} for address ${addressId}`);
      return null;
    }

    const data = (await res.json()) as {
      features?: { center: [number, number] }[];
    };

    const center = data.features?.[0]?.center;
    if (!center) return null;

    const [lng, lat] = center;

    await db.address.update({
      where: { id: addressId },
      data: { lat, lng },
    });

    return { lat, lng };
  } catch (err) {
    console.error(`[geocoding] Error geocoding address ${addressId}:`, err);
    return null;
  }
}

// ── geocodeNewAddresses ────────────────────────────────────────────────────
// Background geocoding for addresses created during a voter CSV import.
// Called fire-and-forget after importVoterRows completes.
// Filters to ungeocoded IDs belonging to the campaign, then processes
// in parallel batches with delay between batches. Never throws.

export async function geocodeNewAddresses(
  campaignId: string,
  addressIds: string[]
): Promise<{ geocoded: number; failed: number }> {
  if (addressIds.length === 0) return { geocoded: 0, failed: 0 };

  try {
    const ungeocoded = await db.address.findMany({
      where: { id: { in: addressIds }, campaignId, lat: null },
      select: { id: true },
    });

    if (ungeocoded.length === 0) return { geocoded: 0, failed: 0 };

    return geocodeInBatches(ungeocoded.map((a) => a.id), "geocodeNewAddresses");
  } catch (err) {
    console.error("[geocoding] Error in geocodeNewAddresses:", err);
    return { geocoded: 0, failed: 0 };
  }
}

// ── geocodeAddressesForCanvassList ─────────────────────────────────────────
// Geocodes all un-geocoded addresses for people on a walk list.
// Processes in parallel batches with a delay between batches.
// Returns counts — never throws.

export async function geocodeAddressesForCanvassList(
  canvassListId: string
): Promise<{ geocoded: number; failed: number }> {
  try {
    const entries = await db.canvassListEntry.findMany({
      where: { canvassListId, deletedAt: null },
      include: {
        person: {
          select: {
            household: {
              select: { addressId: true },
            },
          },
        },
      },
    });

    // Collect unique addressIds that have not yet been geocoded
    const seenIds = new Set<string>();
    const addressIds: string[] = [];

    for (const entry of entries) {
      const addressId = entry.person.household?.addressId;
      if (!addressId || seenIds.has(addressId)) continue;
      seenIds.add(addressId);
      addressIds.push(addressId);
    }

    // Filter to only addresses missing coordinates
    const ungeocoded = await db.address.findMany({
      where: { id: { in: addressIds }, lat: null },
      select: { id: true },
    });

    return geocodeInBatches(ungeocoded.map((a) => a.id), "geocodeAddressesForCanvassList");
  } catch (err) {
    console.error("[geocoding] Error in geocodeAddressesForCanvassList:", err);
    return { geocoded: 0, failed: 0 };
  }
}

// ── geocodeInBatches ───────────────────────────────────────────────────────
// Splits addressIds into chunks of BATCH_SIZE, fires each chunk concurrently
// with Promise.all, and waits BETWEEN_BATCHES_MS between chunks.

async function geocodeInBatches(
  addressIds: string[],
  label: string
): Promise<{ geocoded: number; failed: number }> {
  let geocoded = 0;
  let failed = 0;

  if (addressIds.length === 0) return { geocoded, failed };

  const totalBatches = Math.ceil(addressIds.length / BATCH_SIZE);
  console.log(
    `[geocoding] Starting batch geocoding — ${addressIds.length} addresses, ${totalBatches} batches of ${BATCH_SIZE} (${label})`
  );

  try {
    for (let b = 0; b < totalBatches; b++) {
      const chunk = addressIds.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

      const results = await Promise.all(chunk.map((id) => geocodeAddress(id)));

      let batchGeocoded = 0;
      let batchFailed = 0;
      for (const result of results) {
        if (result) { geocoded++; batchGeocoded++; }
        else         { failed++;   batchFailed++;   }
      }

      console.log(
        `[geocoding] Batch ${b + 1}/${totalBatches} complete — ${batchGeocoded} geocoded, ${batchFailed} failed`
      );

      if (b < totalBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, BETWEEN_BATCHES_MS));
      }
    }
  } catch (err) {
    console.error(`[geocoding] Error in geocodeInBatches (${label}):`, err);
  }

  console.log(`[geocoding] Complete — ${geocoded} geocoded, ${failed} failed (${label})`);
  return { geocoded, failed };
}
