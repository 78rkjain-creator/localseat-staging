"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Polygon } from "geojson";

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
