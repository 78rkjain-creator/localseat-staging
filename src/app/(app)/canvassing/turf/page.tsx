import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageWalkLists } from "@/lib/permissions";
import { db } from "@/lib/db";
import { TurfMapClient } from "./turf-map-client";
import type { Role } from "@/types";

export default async function TurfPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canManageWalkLists(activeRole as Role)) {
    redirect("/canvassing");
  }

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const [
    geocodedAddresses,
    ungeocodedCount,
    recentUngeocodedCount,
    geocodedCount,
    totalCount,
    listEntriesForAddressIds,
    turfLists,
  ] = await Promise.all([
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
    db.address.count({
      where: {
        campaignId: activeCampaignId,
        deletedAt: null,
        lat: null,
        createdAt: { gte: thirtyMinutesAgo },
      },
    }),
    db.address.count({
      where: { campaignId: activeCampaignId, deletedAt: null, lat: { not: null } },
    }),
    db.address.count({
      where: { campaignId: activeCampaignId, deletedAt: null },
    }),
    // Addresses that have at least one person assigned to any walk list
    db.canvassListEntry.findMany({
      where: {
        deletedAt: null,
        canvassList: { campaignId: activeCampaignId, deletedAt: null },
      },
      select: {
        person: {
          select: {
            household: {
              select: { address: { select: { id: true } } },
            },
          },
        },
      },
    }),
    // All walk lists with a saved turf polygon
    db.canvassList.findMany({
      where: { campaignId: activeCampaignId, deletedAt: null },
      select: {
        id: true,
        name: true,
        turfPolygon: true,
        _count: { select: { entries: true } },
        assignments: {
          where: { deletedAt: null },
          select: {
            canvasser: { select: { firstName: true, lastName: true } },
          },
          take: 1,
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);

  const geocodingInProgress = recentUngeocodedCount > 0;

  const assignedAddressIds = [
    ...new Set(
      listEntriesForAddressIds
        .map((e) => e.person.household?.address?.id)
        .filter((id): id is string => id !== null && id !== undefined)
    ),
  ];

  const existingTurfs = turfLists
    .filter((l) => l.turfPolygon !== null)
    .map((l) => ({
      id: l.id,
      name: l.name,
      turfPolygon: l.turfPolygon as object,
      entryCount: l._count.entries,
      canvasserName: l.assignments[0]
        ? `${l.assignments[0].canvasser.firstName} ${l.assignments[0].canvasser.lastName}`
        : null,
    }));

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
      geocodedCount={geocodedCount}
      totalCount={totalCount}
      geocodingInProgress={geocodingInProgress}
      assignedAddressIds={assignedAddressIds}
      existingTurfs={existingTurfs}
    />
  );
}
