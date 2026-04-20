import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageWalkLists } from "@/lib/permissions";
import { db } from "@/lib/db";
import { TurfMapClient } from "./TurfMapClient";
import type { Role } from "@/types";

export default async function TurfPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canManageWalkLists(activeRole as Role)) {
    redirect("/canvassing");
  }

  const [geocodedAddresses, ungeocodedCount] = await Promise.all([
    db.address.findMany({
      where: {
        campaignId: activeCampaignId,
        deletedAt: null,
        lat: { not: null },
        lng: { not: null },
      },
      select: {
        id: true,
        streetNumber: true,
        streetName: true,
        unitNumber: true,
        city: true,
        province: true,
        postalCode: true,
        lat: true,
        lng: true,
      },
    }),
    db.address.count({
      where: {
        campaignId: activeCampaignId,
        deletedAt: null,
        lat: null,
      },
    }),
  ]);

  return (
    <TurfMapClient
      addresses={geocodedAddresses as Array<{
        id: string;
        streetNumber: string;
        streetName: string;
        unitNumber: string | null;
        city: string;
        province: string;
        postalCode: string;
        lat: number;
        lng: number;
      }>}
      campaignId={activeCampaignId}
      ungeocodedCount={ungeocodedCount}
    />
  );
}
