import { db } from "@/lib/db";

const MAPBOX_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const BETWEEN_REQUESTS_MS = 600;

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
// sequentially with delay. Logs progress to server console. Never throws.

export async function geocodeNewAddresses(
  campaignId: string,
  addressIds: string[]
): Promise<void> {
  if (addressIds.length === 0) return;

  try {
    const ungeocoded = await db.address.findMany({
      where: { id: { in: addressIds }, campaignId, lat: null },
      select: { id: true },
    });

    if (ungeocoded.length === 0) return;

    console.log(`[geocoding] Background geocoding started — ${ungeocoded.length} new address(es)`);

    for (let i = 0; i < ungeocoded.length; i++) {
      const { id } = ungeocoded[i];
      const result = await geocodeAddress(id);
      console.log(
        `[geocoding] ${i + 1}/${ungeocoded.length} ${id}: ${
          result ? `${result.lat.toFixed(5)},${result.lng.toFixed(5)}` : "failed"
        }`
      );

      if (i < ungeocoded.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, BETWEEN_REQUESTS_MS));
      }
    }

    console.log("[geocoding] Background geocoding complete");
  } catch (err) {
    console.error("[geocoding] Error in geocodeNewAddresses:", err);
  }
}

// ── geocodeAddressesForCanvassList ─────────────────────────────────────────
// Geocodes all un-geocoded addresses for people on a walk list.
// Processes sequentially with a delay to respect Mapbox rate limits.
// Returns counts — never throws.

export async function geocodeAddressesForCanvassList(
  canvassListId: string
): Promise<{ geocoded: number; failed: number }> {
  let geocoded = 0;
  let failed = 0;

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

    for (let i = 0; i < ungeocoded.length; i++) {
      const { id } = ungeocoded[i];
      const result = await geocodeAddress(id);

      if (result) {
        geocoded++;
      } else {
        failed++;
      }

      // Delay between requests — skip after the last one
      if (i < ungeocoded.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, BETWEEN_REQUESTS_MS));
      }
    }
  } catch (err) {
    console.error("[geocoding] Error in geocodeAddressesForCanvassList:", err);
  }

  return { geocoded, failed };
}
