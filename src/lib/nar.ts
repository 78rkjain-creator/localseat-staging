import { db } from "@/lib/db";

// ── NAR Lookup ──────────────────────────────────────────────────────────────
// Queries the nar schema (StatCan National Address Register) loaded outside
// of Prisma. All queries use $queryRawUnsafe since nar.* tables are not in
// the Prisma schema. Returns null on any failure — never throws.

interface NarCoords {
  lat: number;
  lng: number;
}

interface NarSuggestion {
  streetNumber: string;
  streetName: string;
  streetType: string;
  streetDir: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  displayAddress: string;
}

// ── narGeocode ──────────────────────────────────────────────────────────────
// Given address components, look up coordinates from NAR.
// Tries exact match on civic number + street name + municipality + province.
// Falls back to postal code match if exact match fails.
// Returns null if no match found.

export async function narGeocode(parts: {
  streetNumber: string;
  streetName: string;
  city: string;
  province: string;
  postalCode: string;
}): Promise<NarCoords | null> {
  try {
    // Normalize inputs
    const civicNo = parts.streetNumber.trim();
    const street = parts.streetName.trim().toUpperCase();
    const city = parts.city.trim().toUpperCase();
    const prov = parts.province.trim().toUpperCase();
    const postal = parts.postalCode.replace(/\s/g, "").toUpperCase();

    // Attempt 1: exact match on civic + street + city + province
    if (civicNo && street && city && prov) {
      const rows = await db.$queryRawUnsafe<
        { bg_latitude: number; bg_longitude: number }[]
      >(
        `SELECT l.bg_latitude, l.bg_longitude
         FROM nar.addresses a
         JOIN nar.locations l ON a.loc_guid = l.loc_guid
         WHERE a.civic_no = $1
           AND UPPER(a.mail_street_name) = $2
           AND UPPER(a.mail_mun_name) = $3
           AND UPPER(a.mail_prov_abvn) = $4
           AND l.bg_latitude IS NOT NULL
         LIMIT 1`,
        civicNo,
        street,
        city,
        prov
      );

      if (rows.length > 0) {
        return { lat: rows[0].bg_latitude, lng: rows[0].bg_longitude };
      }
    }

    // Attempt 2: fuzzy street match (trigram) + city + province
    if (civicNo && street && city && prov) {
      const rows = await db.$queryRawUnsafe<
        { bg_latitude: number; bg_longitude: number }[]
      >(
        `SELECT l.bg_latitude, l.bg_longitude
         FROM nar.addresses a
         JOIN nar.locations l ON a.loc_guid = l.loc_guid
         WHERE a.civic_no = $1
           AND a.mail_street_name % $2
           AND UPPER(a.mail_mun_name) = $3
           AND UPPER(a.mail_prov_abvn) = $4
           AND l.bg_latitude IS NOT NULL
         ORDER BY a.mail_street_name <-> $2
         LIMIT 1`,
        civicNo,
        street,
        city,
        prov
      );

      if (rows.length > 0) {
        return { lat: rows[0].bg_latitude, lng: rows[0].bg_longitude };
      }
    }

    // Attempt 3: postal code centroid (average of all addresses with that postal code)
    if (postal) {
      const rows = await db.$queryRawUnsafe<
        { lat: number; lng: number }[]
      >(
        `SELECT AVG(l.bg_latitude) AS lat, AVG(l.bg_longitude) AS lng
         FROM nar.addresses a
         JOIN nar.locations l ON a.loc_guid = l.loc_guid
         WHERE REPLACE(a.mail_postal_code, ' ', '') = $1
           AND l.bg_latitude IS NOT NULL
         HAVING COUNT(*) > 0`,
        postal
      );

      if (rows.length > 0) {
        return { lat: rows[0].lat, lng: rows[0].lng };
      }
    }

    return null;
  } catch (err) {
    console.error("[nar] Geocoding lookup failed:", err);
    return null;
  }
}

// ── narSearch ───────────────────────────────────────────────────────────────
// Autocomplete-style search: returns up to `limit` address suggestions from
// NAR matching the query string. Used by the address search API route.

export async function narSearch(
  query: string,
  limit: number = 5
): Promise<NarSuggestion[]> {
  try {
    const q = query.trim();
    if (q.length < 3) return [];

    // Try to parse a leading civic number from the query
    const match = q.match(/^(\d+)\s+(.+)/);
    let rows: {
      civic_no: string;
      mail_street_name: string;
      official_street_type: string;
      official_street_dir: string;
      mail_mun_name: string;
      mail_prov_abvn: string;
      mail_postal_code: string;
      bg_latitude: number;
      bg_longitude: number;
    }[];

    if (match) {
      // Query has a civic number: "123 Main"
      const civicNo = match[1];
      const streetPart = match[2].trim().toUpperCase();

      rows = await db.$queryRawUnsafe(
        `SELECT DISTINCT ON (a.civic_no, a.mail_street_name, a.mail_mun_name)
                a.civic_no, a.mail_street_name, a.official_street_type,
                a.official_street_dir, a.mail_mun_name, a.mail_prov_abvn,
                a.mail_postal_code, l.bg_latitude, l.bg_longitude
         FROM nar.addresses a
         JOIN nar.locations l ON a.loc_guid = l.loc_guid
         WHERE a.civic_no = $1
           AND a.mail_street_name % $2
           AND l.bg_latitude IS NOT NULL
         ORDER BY a.civic_no, a.mail_street_name, a.mail_mun_name,
                  a.mail_street_name <-> $2
         LIMIT $3`,
        civicNo,
        streetPart,
        limit
      );
    } else {
      // No civic number: just street name search
      const streetPart = q.toUpperCase();

      rows = await db.$queryRawUnsafe(
        `SELECT DISTINCT ON (a.mail_street_name, a.mail_mun_name)
                a.civic_no, a.mail_street_name, a.official_street_type,
                a.official_street_dir, a.mail_mun_name, a.mail_prov_abvn,
                a.mail_postal_code, l.bg_latitude, l.bg_longitude
         FROM nar.addresses a
         JOIN nar.locations l ON a.loc_guid = l.loc_guid
         WHERE a.mail_street_name % $1
           AND l.bg_latitude IS NOT NULL
         ORDER BY a.mail_street_name, a.mail_mun_name,
                  a.mail_street_name <-> $1
         LIMIT $2`,
        streetPart,
        limit
      );
    }

    return rows.map((r) => {
      const parts = [
        r.civic_no,
        r.mail_street_name,
        r.official_street_type,
        r.official_street_dir,
        r.mail_mun_name,
        r.mail_prov_abvn,
        r.mail_postal_code,
      ].filter(Boolean);

      return {
        streetNumber: r.civic_no ?? "",
        streetName: r.mail_street_name ?? "",
        streetType: r.official_street_type ?? "",
        streetDir: r.official_street_dir ?? "",
        city: r.mail_mun_name ?? "",
        province: r.mail_prov_abvn ?? "",
        postalCode: r.mail_postal_code ?? "",
        latitude: r.bg_latitude,
        longitude: r.bg_longitude,
        displayAddress: parts.join(" "),
      };
    });
  } catch (err) {
    console.error("[nar] Search failed:", err);
    return [];
  }
}

// ── narAvailable ────────────────────────────────────────────────────────────
// Quick check whether the nar schema exists and has data.
// Cached for the lifetime of the process.

let _narAvailable: boolean | null = null;

export async function narAvailable(): Promise<boolean> {
  if (_narAvailable !== null) return _narAvailable;

  try {
    const rows = await db.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'nar' AND table_name = 'addresses'
       ) AS exists`
    );
    _narAvailable = rows[0]?.exists ?? false;
  } catch {
    _narAvailable = false;
  }

  return _narAvailable;
}

// ── narAddressesInBoundary ─────────────────────────────────────────────────
// Returns all NAR addresses whose location falls inside a GeoJSON polygon.
// Uses PostGIS ST_Contains for fast spatial lookup against the GIST index.
// The polygon must be GeoJSON Polygon or MultiPolygon with WGS84 coordinates.
// Returns up to `limit` results (default 10,000 — a typical ward has 5,000-15,000).

export interface NarBoundaryAddress {
  locGuid: string;
  addrGuid: string;
  streetNumber: string;
  streetName: string;
  streetType: string;
  streetDir: string;
  unitLabel: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

export async function narAddressesInBoundary(
  geojson: { type: string; coordinates: unknown },
  limit: number = 10000
): Promise<NarBoundaryAddress[]> {
  try {
    if (!await narAvailable()) return [];

    const geojsonStr = JSON.stringify(geojson);

    const rows = await db.$queryRawUnsafe<
      {
        loc_guid: string;
        addr_guid: string;
        civic_no: string;
        mail_street_name: string;
        official_street_type: string;
        official_street_dir: string;
        apt_no_label: string;
        mail_mun_name: string;
        mail_prov_abvn: string;
        mail_postal_code: string;
        bg_latitude: number;
        bg_longitude: number;
      }[]
    >(
      `SELECT a.loc_guid, a.addr_guid, a.civic_no, a.mail_street_name,
              a.official_street_type, a.official_street_dir, a.apt_no_label,
              a.mail_mun_name, a.mail_prov_abvn, a.mail_postal_code,
              l.bg_latitude, l.bg_longitude
       FROM nar.locations l
       JOIN nar.addresses a ON a.loc_guid = l.loc_guid
       WHERE l.geom IS NOT NULL
         AND ST_Contains(
               ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
               l.geom
             )
       LIMIT $2`,
      geojsonStr,
      limit
    );

    return rows.map((r) => ({
      locGuid: r.loc_guid,
      addrGuid: r.addr_guid,
      streetNumber: r.civic_no ?? "",
      streetName: r.mail_street_name ?? "",
      streetType: r.official_street_type ?? "",
      streetDir: r.official_street_dir ?? "",
      unitLabel: r.apt_no_label ?? "",
      city: r.mail_mun_name ?? "",
      province: r.mail_prov_abvn ?? "",
      postalCode: r.mail_postal_code ?? "",
      latitude: r.bg_latitude,
      longitude: r.bg_longitude,
    }));
  } catch (err) {
    console.error("[nar] Boundary query failed:", err);
    return [];
  }
}

// ── narCountInBoundary ─────────────────────────────────────────────────────
// Fast count-only version — no address details, just how many NAR locations
// fall inside the polygon. Useful for UI previews before loading full data.

export async function narCountInBoundary(
  geojson: { type: string; coordinates: unknown }
): Promise<number> {
  try {
    if (!await narAvailable()) return 0;

    const geojsonStr = JSON.stringify(geojson);

    const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) AS count
       FROM nar.locations l
       WHERE l.geom IS NOT NULL
         AND ST_Contains(
               ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
               l.geom
             )`,
      geojsonStr
    );

    return Number(rows[0]?.count ?? 0);
  } catch (err) {
    console.error("[nar] Boundary count failed:", err);
    return 0;
  }
}
