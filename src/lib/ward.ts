import type { Polygon } from "geojson";
import type { Prisma } from "@prisma/client";

// ── Ray-cast point-in-polygon ─────────────────────────────────────────────────
// Mirrors the algorithm used in TurfMapClient.tsx.
// GeoJSON coordinates are [lng, lat]; point is supplied as lat, lng separately.

export function isPointInWard(
  lat: number,
  lng: number,
  boundary: Polygon
): boolean {
  const ring = boundary.coordinates[0];
  const px = lng;
  const py = lat;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ri = ring[i];
    const rj = ring[j];
    const xi = ri[0];
    const yi = ri[1];
    const xj = rj[0];
    const yj = rj[1];

    if (
      xi === undefined ||
      yi === undefined ||
      xj === undefined ||
      yj === undefined
    ) {
      continue;
    }

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

// ── Ward boundary presence check ──────────────────────────────────────────────

export function campaignHasWard(campaign: {
  wardBoundary: Prisma.JsonValue | null;
}): boolean {
  return campaign.wardBoundary !== null;
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
