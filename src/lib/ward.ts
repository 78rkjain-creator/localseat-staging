import type { Polygon, MultiPolygon } from "geojson";
import type { Prisma } from "@prisma/client";
import { WardStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { geocodeAddress } from "./geocoding";

// ── Ray-cast point-in-polygon ─────────────────────────────────────────────────
// GeoJSON coordinates are [lng, lat]; point is supplied as lat, lng separately.
// For MultiPolygon, a point is inside if it's inside any component polygon.

function isPointInPolygonRing(
  py: number,
  px: number,
  ring: (number[] | readonly number[])[]
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ri = ring[i];
    const rj = ring[j];
    const xi = ri?.[0];
    const yi = ri?.[1];
    const xj = rj?.[0];
    const yj = rj?.[1];
    if (xi === undefined || yi === undefined || xj === undefined || yj === undefined) continue;
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInWard(
  lat: number,
  lng: number,
  boundary: Polygon | MultiPolygon
): boolean {
  if (boundary.type === "Polygon") {
    const ring = boundary.coordinates[0];
    if (!ring) return false;
    return isPointInPolygonRing(lat, lng, ring);
  }

  // MultiPolygon — inside if inside any component polygon's outer ring
  for (const poly of boundary.coordinates) {
    const ring = poly[0];
    if (ring && isPointInPolygonRing(lat, lng, ring)) return true;
  }
  return false;
}

// ── Ward boundary presence check ──────────────────────────────────────────────

export function campaignHasWard(campaign: {
  wardBoundary: Prisma.JsonValue | null;
}): boolean {
  return campaign.wardBoundary !== null;
}

// ── Geocode + classify a single address ───────────────────────────────────────
// Resolves coordinates for the given address (using cached lat/lng if present,
// otherwise calling Mapbox). Then, if the campaign has a wardBoundary and a
// personId is supplied, updates the Person's wardStatus and isOutOfDistrict.
// Anonymized persons are skipped for the Person update; the Address is still
// geocoded because coordinates are not PII.
// Never throws — all failures are caught and logged.

export async function geocodeAndClassifyAddress(
  addressId: string,
  campaignId: string,
  personId?: string,
): Promise<void> {
  try {
    const address = await db.address.findUnique({
      where: { id: addressId },
      select: {
        campaignId: true,
        streetNumber: true,
        streetName: true,
        city: true,
        lat: true,
        lng: true,
      },
    });

    if (!address) return;
    if (address.campaignId !== campaignId) return;
    // Defensive: skip addresses with no street fields
    if (!address.streetNumber || !address.streetName || !address.city) return;

    // Use cached coords if available, otherwise geocode and persist
    let coords: { lat: number; lng: number } | null = null;
    if (address.lat !== null && address.lng !== null) {
      coords = { lat: address.lat, lng: address.lng };
    } else {
      coords = await geocodeAddress(addressId);
    }

    if (!coords) return; // geocoding failed or token missing — address left un-geocoded

    if (!personId) return;

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { wardBoundary: true },
    });
    if (!campaign?.wardBoundary) return; // geocoding was still useful; no boundary to classify against

    const boundary = campaign.wardBoundary as unknown as Polygon | MultiPolygon;
    const inside = isPointInWard(coords.lat, coords.lng, boundary);
    const wardStatus = inside ? WardStatus.inside : WardStatus.outside;

    const person = await db.person.findUnique({
      where: { id: personId },
      select: { anonymizedAt: true },
    });
    // Skip Person update for anonymized records; coordinates are not PII
    if (!person || person.anonymizedAt !== null) return;

    await db.person.update({
      where: { id: personId },
      data: {
        wardStatus,
        needsDistrictClassification: false,
        ...(inside ? {} : { isOutOfDistrict: true }),
      },
    });
  } catch (err) {
    console.error(`[ward] geocodeAndClassifyAddress error — address ${addressId}:`, err);
  }
}

// ── KML → GeoJSON Polygon ─────────────────────────────────────────────────────
// Handles simple single-polygon KML only — extracts the first <coordinates>
// block. Does not support multi-polygon KML, multi-geometry, or namespaced
// coordinate elements. Returns null if parsing fails for any reason.

export function parseKmlToGeoJsonPolygon(kmlString: string): Polygon | null {
  try {
    const match = kmlString.match(
      /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/
    );
    if (!match || !match[1]) return null;

    const raw = match[1].trim();

    const coords: [number, number][] = raw
      .split(/\s+/)
      .filter(Boolean)
      .map((triple) => {
        const parts = triple.split(",");
        if (parts.length < 2) throw new Error("Invalid coordinate triplet");
        const lng = parseFloat(parts[0] ?? "");
        const lat = parseFloat(parts[1] ?? "");
        if (isNaN(lng) || isNaN(lat)) throw new Error("NaN coordinate");
        return [lng, lat];
      });

    // A valid polygon ring needs at least 4 positions (first = last to close it)
    if (coords.length < 4) return null;

    return {
      type: "Polygon",
      coordinates: [coords],
    };
  } catch {
    return null;
  }
}
