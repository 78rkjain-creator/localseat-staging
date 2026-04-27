"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageWalkLists, canAssignCanvassers } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { geocodeAddressesForCanvassList } from "@/lib/geocoding";
import { ListSource, WardStatus } from "@prisma/client";
import type { Role } from "@/types";

// ── Create walk list ───────────────────────────────────────────────────────

export async function createCanvassList(
  formData: FormData
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canManageWalkLists(activeRole as Role)) {
    return { error: "You don't have permission to create walk lists." };
  }

  const name = (formData.get("name") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;

  if (!name || name.length === 0) return { error: "Name is required." };
  if (name.length > 120) return { error: "Name is too long." };

  const list = await db.canvassList.create({
    data: {
      campaignId: activeCampaignId,
      name,
      description,
    },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "WALK_LIST_CREATED",
    entityType: "canvass_list",
    entityId: list.id,
    details: { name, description: description ?? null },
  });

  revalidatePath("/canvassing");
  geocodeAddressesForCanvassList(list.id);
  redirect(`/canvassing/${list.id}`);
}

// ── Create turf walk list ─────────────────────────────────────────────────

export async function createTurfCanvassList(data: {
  name: string;
  description?: string;
  polygon: object;
  addressIds: string[];
}): Promise<{ error?: string; listId?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canManageWalkLists(activeRole as Role)) {
    return { error: "You don't have permission to create walk lists." };
  }

  const name = data.name.trim();
  if (!name) return { error: "Name is required." };
  if (name.length > 120) return { error: "Name is too long." };
  if (data.addressIds.length === 0) return { error: "No addresses selected." };

  // Find all people linked to the selected addresses via Household.
  // Out-of-district people are hard-excluded (no override).
  // Manual and team records are soft-excluded (overridable via includeInWalkLists).
  const people = await db.person.findMany({
    where: {
      campaignId: activeCampaignId,
      deletedAt: null,
      isOutOfDistrict: false,
      household: {
        addressId: { in: data.addressIds },
        deletedAt: null,
      },
      OR: [
        { includeInWalkLists: true },
        {
          AND: [
            { listSource: { notIn: [ListSource.manual, ListSource.team] } },
            { wardStatus: { notIn: [WardStatus.outside, WardStatus.pending_review] } },
          ],
        },
      ],
    },
    select: { id: true },
  });

  const list = await db.canvassList.create({
    data: {
      campaignId: activeCampaignId,
      name,
      description: data.description?.trim() || null,
      turfPolygon: data.polygon,
      turfCreatedAt: new Date(),
    },
  });

  if (people.length > 0) {
    await db.canvassListEntry.createMany({
      data: people.map((p) => ({
        canvassListId: list.id,
        personId: p.id,
        addedById: session.user.id,
      })),
      skipDuplicates: true,
    });
  }

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "CANVASS_LIST_CREATED",
    entityType: "canvass_list",
    entityId: list.id,
    details: {
      name,
      source: "turf_map",
      addressCount: data.addressIds.length,
      personCount: people.length,
    },
  });

  revalidatePath("/canvassing");
  geocodeAddressesForCanvassList(list.id);
  return { listId: list.id };
}

// ── Route optimization ────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function optimizeRoute(
  listId: string
): Promise<{ error?: string; count?: number }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canAssignCanvassers(activeRole as Role)) {
    return { error: "You don't have permission to optimize routes." };
  }

  // Verify list belongs to this campaign
  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!list) return { error: "Walk list not found." };

  const entries = await db.canvassListEntry.findMany({
    where: { canvassListId: listId, deletedAt: null },
    select: {
      id: true,
      person: {
        select: {
          household: {
            select: {
              address: { select: { lat: true, lng: true } },
            },
          },
        },
      },
    },
  });

  // Partition into geocoded (has lat/lng) and ungeocoded
  type EntryWithCoords = { id: string; lat: number; lng: number };
  const geocoded: EntryWithCoords[] = [];
  const ungeocodedIds: string[] = [];

  for (const e of entries) {
    const addr = e.person.household?.address;
    if (addr?.lat !== null && addr?.lat !== undefined && addr?.lng !== null && addr?.lng !== undefined) {
      geocoded.push({ id: e.id, lat: addr.lat, lng: addr.lng });
    } else {
      ungeocodedIds.push(e.id);
    }
  }

  // Nearest-neighbor heuristic starting from the first entry's position
  const ordered: EntryWithCoords[] = [];
  const unvisited = new Set(geocoded);

  // Seed with the first entry (stable starting point)
  if (unvisited.size > 0) {
    const first = geocoded[0];
    unvisited.delete(first);
    ordered.push(first);

    while (unvisited.size > 0) {
      const last = ordered[ordered.length - 1];
      let nearest: EntryWithCoords | null = null;
      let nearestDist = Infinity;

      for (const candidate of unvisited) {
        const dist = haversineKm(last.lat, last.lng, candidate.lat, candidate.lng);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = candidate;
        }
      }

      if (nearest) {
        unvisited.delete(nearest);
        ordered.push(nearest);
      }
    }
  }

  // Build full ordered list: geocoded (optimized) + ungeocoded (appended)
  const allOrdered = [
    ...ordered.map((e) => e.id),
    ...ungeocodedIds,
  ];

  await db.$transaction(
    allOrdered.map((id, idx) =>
      db.canvassListEntry.update({
        where: { id },
        data: { sortOrder: idx },
      })
    )
  );

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "ROUTE_OPTIMIZED",
    entityType: "canvass_list",
    entityId: listId,
    details: { geocodedCount: geocoded.length, ungeocodedCount: ungeocodedIds.length },
  });

  revalidatePath(`/canvassing/${listId}`);
  return { count: allOrdered.length };
}

// ── Assign canvasser ──────────────────────────────────────────────────────

export async function assignCanvasser(
  listId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canAssignCanvassers(activeRole as Role)) {
    return { error: "You don't have permission to assign canvassers." };
  }

  const canvasserId = (formData.get("canvasserId") as string | null)?.trim();
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!canvasserId) return { error: "Select a canvasser." };

  // Verify list belongs to campaign (tenant safety)
  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!list) return { error: "Walk list not found." };

  // Verify canvasser is a member of this campaign
  const membership = await db.campaignMembership.findFirst({
    where: { userId: canvasserId, campaignId: activeCampaignId, deletedAt: null, role: { not: "finance_lead" as const } },
  });
  if (!membership) return { error: "User is not eligible to be assigned to this walk list." };

  // Prevent duplicate assignment
  const existing = await db.canvassAssignment.findFirst({
    where: { canvassListId: listId, canvasserId, deletedAt: null },
  });
  if (existing) return { error: "This canvasser is already assigned to this list." };

  const assignment = await db.canvassAssignment.create({
    data: { canvassListId: listId, canvasserId, notes },
    select: { id: true },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "CANVASSER_ASSIGNED",
    entityType: "canvass_assignment",
    entityId: assignment.id,
    details: { listId, canvasserId },
  });

  revalidatePath(`/canvassing/${listId}`);
  return {};
}
