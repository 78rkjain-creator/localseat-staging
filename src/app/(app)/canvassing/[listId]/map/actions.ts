"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Polygon, MultiPolygon } from "geojson";
import { narAddressesInBoundary, narCountInBoundary, narAvailable } from "@/lib/nar";
import type { NarBoundaryAddress } from "@/lib/nar";

export async function getWardBoundary(): Promise<Polygon | null> {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return null;

  const campaign = await db.campaign.findUnique({
    where: { id: activeCampaignId },
    select: { wardBoundary: true },
  });

  if (!campaign?.wardBoundary) return null;
  return campaign.wardBoundary as unknown as Polygon;
}

export async function getMunicipalityBoundary(): Promise<Polygon | MultiPolygon | null> {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return null;

  const campaign = await db.campaign.findUnique({
    where: { id: activeCampaignId },
    select: { municipalityBoundary: true },
  });

  if (!campaign?.municipalityBoundary) return null;
  return campaign.municipalityBoundary as unknown as Polygon | MultiPolygon;
}

// ── NAR spatial queries ───────────────────────────────────────────────────

export async function isNarAvailable(): Promise<boolean> {
  return narAvailable();
}

// Count NAR addresses inside a drawn polygon (fast preview)
export async function getNarCountInPolygon(
  geojson: { type: string; coordinates: unknown }
): Promise<number> {
  const session = await getServerSession(authOptions);
  if (!session) return 0;
  return narCountInBoundary(geojson);
}

// Get all NAR addresses inside a drawn polygon (for walk list creation)
export async function getNarAddressesInPolygon(
  geojson: { type: string; coordinates: unknown },
  limit: number = 10000
): Promise<NarBoundaryAddress[]> {
  const session = await getServerSession(authOptions);
  if (!session) return [];
  return narAddressesInBoundary(geojson, limit);
}

// Get all NAR addresses inside the campaign's ward boundary
export async function getNarAddressesInWard(): Promise<{
  addresses: NarBoundaryAddress[];
  count: number;
}> {
  const session = await getServerSession(authOptions);
  if (!session) return { addresses: [], count: 0 };

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return { addresses: [], count: 0 };

  const campaign = await db.campaign.findUnique({
    where: { id: activeCampaignId },
    select: { wardBoundary: true },
  });

  if (!campaign?.wardBoundary) return { addresses: [], count: 0 };

  const boundary = campaign.wardBoundary as unknown as Polygon | MultiPolygon;
  const addresses = await narAddressesInBoundary(boundary);

  return { addresses, count: addresses.length };
}
