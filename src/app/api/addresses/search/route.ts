import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeFullAddress } from "@/lib/address-normalize";
import { narSearch, narAvailable } from "@/lib/nar";

export const dynamic = "force-dynamic";

// ── Shared types (imported by address-picker.tsx) ─────────────────────────────

export interface CampaignAddress {
  id: string;
  streetNumber: string;
  streetName: string;
  unitNumber: string | null;
  city: string;
  province: string;
  postalCode: string;
  residentCount: number;
}

export interface MapboxSuggestion {
  streetNumber: string;
  streetName: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  displayAddress: string;
}

export interface NarSuggestion {
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

export interface AddressSearchResponse {
  campaign: CampaignAddress[];
  nar: NarSuggestion[];
  mapbox: MapboxSuggestion[];
}

// ── Mapbox parsing ─────────────────────────────────────────────────────────────

const MAPBOX_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

interface MapboxContext {
  id: string;
  text: string;
  short_code?: string;
}

interface MapboxFeature {
  address?: string;
  text: string;
  center: [number, number];
  place_name: string;
  context?: MapboxContext[];
}

function parseFeature(feature: MapboxFeature): MapboxSuggestion | null {
  const streetNumber = feature.address ?? "";
  const streetName = feature.text;
  const [lng, lat] = feature.center;

  let postalCode = "";
  let city = "";
  let province = "";

  for (const ctx of feature.context ?? []) {
    if (ctx.id.startsWith("postcode")) {
      postalCode = ctx.text;
    } else if (ctx.id.startsWith("place")) {
      city = ctx.text;
    } else if (ctx.id.startsWith("region")) {
      const parts = ctx.short_code?.split("-");
      province = parts?.[parts.length - 1] ?? ctx.text;
    }
  }

  if (!city || !streetName) return null;

  return {
    streetNumber,
    streetName,
    city,
    province,
    postalCode,
    latitude: lat,
    longitude: lng,
    displayAddress: feature.place_name,
  };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ campaign: [], nar: [], mapbox: [] }, { status: 401 });

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return NextResponse.json({ campaign: [], nar: [], mapbox: [] });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ campaign: [], nar: [], mapbox: [] });

  const token = process.env.MAPBOX_SERVER_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const hasNar = await narAvailable();

  // DB query + NAR search + Mapbox call run in parallel
  const [campaignRows, narRows, mapboxRaw] = await Promise.all([
    db.address.findMany({
      where: {
        campaignId: activeCampaignId,
        deletedAt: null,
        OR: [
          { streetName: { contains: q, mode: "insensitive" } },
          { streetNumber: { contains: q, mode: "insensitive" } },
          { postalCode: { contains: q.replace(/\s/g, ""), mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        streetNumber: true,
        streetName: true,
        unitNumber: true,
        city: true,
        province: true,
        postalCode: true,
      },
      orderBy: [{ streetName: "asc" }, { streetNumber: "asc" }],
      take: 10,
    }),
    hasNar ? narSearch(q, 5) : Promise.resolve([]),
    // Only call Mapbox if NAR is unavailable (saves API costs)
    !hasNar && token
      ? fetch(
          `${MAPBOX_BASE}/${encodeURIComponent(q)}.json` +
            `?access_token=${token}&country=ca&types=address&autocomplete=true&limit=5`,
        )
          .then((r) => (r.ok ? (r.json() as Promise<{ features?: MapboxFeature[] }>) : null))
          .catch((err) => {
            console.warn("[addresses/search] Mapbox error:", err);
            return null;
          })
      : Promise.resolve(null),
  ]);

  // ── Resident counts (2 extra queries, no N+1) ─────────────────────────────────
  const addressIds = campaignRows.map((a) => a.id);
  const countByAddr = new Map<string, number>();

  if (addressIds.length > 0) {
    const households = await db.household.findMany({
      where: { addressId: { in: addressIds }, deletedAt: null },
      select: { id: true, addressId: true },
    });
    const hhToAddr = new Map(households.map((h) => [h.id, h.addressId]));

    if (households.length > 0) {
      const groups = await db.person.groupBy({
        by: ["householdId"],
        where: {
          householdId: { in: households.map((h) => h.id) },
          deletedAt: null,
          anonymizedAt: null,
        },
        _count: { id: true },
      });
      for (const g of groups) {
        if (!g.householdId) continue;
        const addrId = hhToAddr.get(g.householdId);
        if (addrId) {
          countByAddr.set(addrId, (countByAddr.get(addrId) ?? 0) + g._count.id);
        }
      }
    }
  }

  const campaign: CampaignAddress[] = campaignRows.map((a) => ({
    ...a,
    residentCount: countByAddr.get(a.id) ?? 0,
  }));

  // ── Server-side dedup: suppress NAR/Mapbox rows that match a campaign address ──
  const campaignKeys = new Set(
    campaign.map(
      (a) =>
        `${a.streetNumber.toLowerCase().trim()}|${normalizeFullAddress(a.streetName, a.city)}`,
    ),
  );

  // Dedup NAR results against campaign addresses
  const nar: NarSuggestion[] = [];
  for (const row of narRows) {
    const key = `${row.streetNumber.toLowerCase().trim()}|${normalizeFullAddress(row.streetName, row.city)}`;
    if (campaignKeys.has(key)) continue;
    nar.push(row);
  }

  // Add NAR keys to dedup set so Mapbox doesn't duplicate them
  const narKeys = new Set(
    nar.map(
      (a) =>
        `${a.streetNumber.toLowerCase().trim()}|${normalizeFullAddress(a.streetName, a.city)}`,
    ),
  );

  const mapbox: MapboxSuggestion[] = [];
  for (const feature of mapboxRaw?.features ?? []) {
    const suggestion = parseFeature(feature);
    if (!suggestion) continue;
    const key = `${suggestion.streetNumber.toLowerCase().trim()}|${normalizeFullAddress(suggestion.streetName, suggestion.city)}`;
    if (campaignKeys.has(key) || narKeys.has(key)) continue;
    mapbox.push(suggestion);
  }

  const response: AddressSearchResponse = { campaign, nar, mapbox };
  return NextResponse.json(response);
}
