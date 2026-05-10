import { db } from "@/lib/db";

const MAPBOX_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const BATCH_SIZE = 10;
const BETWEEN_BATCHES_MS = 600;

// Prefer a dedicated server token for server-side geocoding (allows stricter
// URL restrictions and separate rate limits). Falls back to the public token.
function getMapboxToken(): string | undefined {
  return process.env.MAPBOX_SERVER_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
}

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

    const token = getMapboxToken();
    if (!token) {
      console.warn("[geocoding] No Mapbox token configured (MAPBOX_SERVER_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN)");
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

    const seenIds = new Set<string>();
    const addressIds: string[] = [];

    for (const entry of entries) {
      const addressId = entry.person.household?.addressId;
      if (!addressId || seenIds.has(addressId)) continue;
      seenIds.add(addressId);
      addressIds.push(addressId);
    }

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
// Splits addressIds into chunks of BATCH_SIZE.
// Per chunk: one findMany to load all rows, concurrent Mapbox API calls for
// the ungeocoded subset, then one $transaction to write all coordinates.

async function geocodeInBatches(
  addressIds: string[],
  label: string
): Promise<{ geocoded: number; failed: number }> {
  let geocoded = 0;
  let failed = 0;

  if (addressIds.length === 0) return { geocoded, failed };

  const token = getMapboxToken();
  if (!token) {
    console.warn("[geocoding] No Mapbox token configured (MAPBOX_SERVER_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN)");
    return { geocoded: 0, failed: addressIds.length };
  }

  const totalBatches = Math.ceil(addressIds.length / BATCH_SIZE);
  console.log(
    `[geocoding] Starting batch geocoding — ${addressIds.length} addresses, ${totalBatches} batches of ${BATCH_SIZE} (${label})`
  );

  try {
    for (let b = 0; b < totalBatches; b++) {
      const chunkIds = addressIds.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

      // One query for the whole chunk
      const addresses = await db.address.findMany({
        where: { id: { in: chunkIds } },
        select: {
          id: true,
          lat: true,
          lng: true,
          streetNumber: true,
          streetName: true,
          city: true,
          province: true,
          postalCode: true,
        },
      });

      const alreadyCached = addresses.filter((a) => a.lat !== null && a.lng !== null).length;
      geocoded += alreadyCached;

      const toGeocode = addresses.filter((a) => a.lat === null || a.lng === null);

      // Concurrent Mapbox calls for ungeocoded addresses
      const apiResults = await Promise.all(
        toGeocode.map(async (address) => {
          try {
            const query = [
              address.streetNumber,
              address.streetName,
              address.city,
              address.province,
              address.postalCode,
              "Canada",
            ].join(", ");

            const url =
              `${MAPBOX_BASE}/${encodeURIComponent(query)}.json` +
              `?access_token=${token}&country=ca&limit=1`;

            const res = await fetch(url);
            if (!res.ok) {
              console.warn(`[geocoding] Mapbox returned ${res.status} for address ${address.id}`);
              return { id: address.id, coords: null as null };
            }

            const data = (await res.json()) as {
              features?: { center: [number, number] }[];
            };

            const center = data.features?.[0]?.center;
            if (!center) return { id: address.id, coords: null as null };

            const [lng, lat] = center;
            return { id: address.id, coords: { lat, lng } };
          } catch (err) {
            console.error(`[geocoding] Error geocoding address ${address.id}:`, err);
            return { id: address.id, coords: null as null };
          }
        })
      );

      const successful = apiResults.filter(
        (r): r is { id: string; coords: { lat: number; lng: number } } => r.coords !== null
      );
      const batchFailed = apiResults.length - successful.length;

      // One transaction for all coordinate writes in this chunk
      if (successful.length > 0) {
        await db.$transaction(
          successful.map(({ id, coords }) =>
            db.address.update({ where: { id }, data: { lat: coords.lat, lng: coords.lng } })
          )
        );
      }

      geocoded += successful.length;
      failed += batchFailed;

      console.log(
        `[geocoding] Batch ${b + 1}/${totalBatches} complete — ${successful.length} geocoded, ${alreadyCached} cached, ${batchFailed} failed`
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
