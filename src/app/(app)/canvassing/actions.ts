"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageWalkLists, canAssignCanvassers } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { geocodeAddressesForCanvassList } from "@/lib/geocoding";
import { checkSupportWriteAccess } from "@/lib/support-access";
import { ListSource, WardStatus, CanvassListStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { Role } from "@/types";
import type { DynamicFilters } from "@/lib/canvassing";

// ── Helpers ────────────────────────────────────────────────────────────────

function statusForRole(role: string): CanvassListStatus {
  return role === "field_organizer"
    ? CanvassListStatus.pending_approval
    : CanvassListStatus.active;
}

const APPROVER_ROLES: Role[] = ["candidate", "campaign_manager", "data_manager", "co_chair"];

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

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const name = (formData.get("name") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || null;

  if (!name || name.length === 0) return { error: "Name is required." };
  if (name.length > 120) return { error: "Name is too long." };

  const isDynamic = formData.get("isDynamic") === "true";
  let dynamicFilters: DynamicFilters | null = null;
  if (isDynamic) {
    const raw = formData.get("dynamicFilters") as string | null;
    if (raw) {
      try {
        dynamicFilters = JSON.parse(raw) as DynamicFilters;
      } catch {
        return { error: "Invalid filter data." };
      }
    }
  }

  const status = statusForRole(activeRole);
  const isGotvList = formData.get("isGotvList") === "true";
  const surveyId = (formData.get("surveyId") as string) || null;

  const list = await db.canvassList.create({
    data: {
      campaignId: activeCampaignId,
      name,
      description,
      status,
      isGotvList,
      surveyId,
      dynamicFilters: dynamicFilters as Prisma.InputJsonValue | undefined,
    },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "WALK_LIST_CREATED",
    entityType: "canvass_list",
    entityId: list.id,
    details: { name, description: description ?? null, isDynamic, status },
  });

  // If dynamic, run initial population now (before redirect)
  if (dynamicFilters) {
    await _doRefresh(list.id, activeCampaignId, session.user.id, dynamicFilters);
  } else {
    geocodeAddressesForCanvassList(list.id);
  }

  revalidatePath("/canvassing");
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

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const name = data.name.trim();
  if (!name) return { error: "Name is required." };
  if (name.length > 120) return { error: "Name is too long." };
  if (data.addressIds.length === 0) return { error: "No addresses selected." };

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

  const status = statusForRole(activeRole);

  const list = await db.canvassList.create({
    data: {
      campaignId: activeCampaignId,
      name,
      description: data.description?.trim() || null,
      turfPolygon: data.polygon,
      turfCreatedAt: new Date(),
      status,
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
      status,
    },
  });

  revalidatePath("/canvassing");
  geocodeAddressesForCanvassList(list.id);
  return { listId: list.id };
}

// ── Dynamic list refresh ──────────────────────────────────────────────────

// Internal refresh — called from both the server action and the page server component.
export async function _doRefresh(
  listId: string,
  campaignId: string,
  userId: string,
  filtersOverride?: DynamicFilters | null
): Promise<{ added: number; removed: number }> {
  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId, deletedAt: null },
    select: { dynamicFilters: true },
  });
  if (!list) return { added: 0, removed: 0 };

  const filters = (filtersOverride !== undefined
    ? filtersOverride
    : list.dynamicFilters) as DynamicFilters | null;
  if (!filters) return { added: 0, removed: 0 };

  // Build WHERE clause with standard walk-list hard/soft exclusions
  const andConditions: Prisma.PersonWhereInput[] = [];

  if (filters.supportLevels?.length) {
    andConditions.push({
      canvassResponses: { some: { supportLevel: { in: filters.supportLevels as ("strong_yes" | "soft_yes" | "undecided" | "soft_no" | "strong_no")[] } } },
    });
  }

  if (filters.canvassStatus === "not_yet_canvassed") {
    andConditions.push({ canvassResponses: { none: {} } });
  } else if (filters.canvassStatus === "canvassed") {
    andConditions.push({ canvassResponses: { some: {} } });
  } else if (filters.canvassStatus === "not_home") {
    andConditions.push({ canvassResponses: { some: { outcome: "not_home" } } });
  }

  if (filters.tagIds?.length) {
    andConditions.push({ tags: { some: { tagId: { in: filters.tagIds } } } });
  }

  if (filters.wardStatuses?.length) {
    andConditions.push({ wardStatus: { in: filters.wardStatuses as WardStatus[] } });
  }

  const where: Prisma.PersonWhereInput = {
    campaignId,
    deletedAt: null,
    isOutOfDistrict: false,
    OR: [
      { includeInWalkLists: true },
      {
        AND: [
          { listSource: { notIn: [ListSource.manual, ListSource.team] } },
          { wardStatus: { notIn: [WardStatus.outside, WardStatus.pending_review] } },
        ],
      },
    ],
    ...(andConditions.length > 0 ? { AND: andConditions } : {}),
  };

  const matchingPeople = await db.person.findMany({ where, select: { id: true } });
  const matchingIds = new Set(matchingPeople.map((p) => p.id));

  // Current state of entries (including soft-deleted so we can re-activate)
  const allEntries = await db.canvassListEntry.findMany({
    where: { canvassListId: listId },
    select: { id: true, personId: true, deletedAt: true },
  });

  // People who already have a canvass response on this list — never remove them
  const respondedIds = new Set(
    (await db.canvassResponse.findMany({
      where: { assignment: { canvassListId: listId } },
      select: { personId: true },
      distinct: ["personId"],
    })).map((r) => r.personId)
  );

  const activeByPerson = new Map(
    allEntries.filter((e) => !e.deletedAt).map((e) => [e.personId, e.id])
  );
  const deletedByPerson = new Map(
    allEntries.filter((e) => e.deletedAt).map((e) => [e.personId, e.id])
  );

  // People to add: match but not active in list
  const toAdd = [...matchingIds].filter((id) => !activeByPerson.has(id));
  // People to remove: active but no longer match and no responses
  const toRemove = [...activeByPerson.keys()].filter(
    (id) => !matchingIds.has(id) && !respondedIds.has(id)
  );

  const now = new Date();

  await db.$transaction(async (tx) => {
    // Re-activate previously deleted entries
    const toReactivate = toAdd.filter((id) => deletedByPerson.has(id));
    if (toReactivate.length > 0) {
      await tx.canvassListEntry.updateMany({
        where: { id: { in: toReactivate.map((pid) => deletedByPerson.get(pid)!) } },
        data: { deletedAt: null },
      });
    }

    // Create brand-new entries
    const toCreate = toAdd.filter((id) => !deletedByPerson.has(id));
    if (toCreate.length > 0) {
      await tx.canvassListEntry.createMany({
        data: toCreate.map((personId) => ({
          canvassListId: listId,
          personId,
          addedById: userId,
        })),
        skipDuplicates: true,
      });
    }

    // Soft-delete entries that no longer match
    if (toRemove.length > 0) {
      await tx.canvassListEntry.updateMany({
        where: { canvassListId: listId, personId: { in: toRemove }, deletedAt: null },
        data: { deletedAt: now },
      });
    }

    await tx.canvassList.update({
      where: { id: listId },
      data: { lastRefreshedAt: now },
    });
  });

  return { added: toAdd.length, removed: toRemove.length };
}

// Public server action for the "Refresh now" button
export async function refreshDynamicList(
  listId: string
): Promise<{ error?: string; added?: number; removed?: number }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canManageWalkLists(activeRole as Role)) {
    return { error: "You don't have permission to manage walk lists." };
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { dynamicFilters: true },
  });
  if (!list) return { error: "Walk list not found." };
  if (!list.dynamicFilters) return { error: "This list is not dynamic." };

  const { added, removed } = await _doRefresh(listId, activeCampaignId, session.user.id);
  revalidatePath(`/canvassing/${listId}`);
  return { added, removed };
}

// ── Approval workflow ─────────────────────────────────────────────────────

export async function approveList(
  listId: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !APPROVER_ROLES.includes(activeRole as Role)) {
    return { error: "You don't have permission to approve walk lists." };
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true, status: true, name: true },
  });
  if (!list) return { error: "Walk list not found." };
  if (list.status !== CanvassListStatus.pending_approval) {
    return { error: "This list is not pending approval." };
  }

  await db.canvassList.update({
    where: { id: listId },
    data: { status: CanvassListStatus.active, rejectionReason: null },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "WALK_LIST_APPROVED",
    entityType: "canvass_list",
    entityId: listId,
    details: { name: list.name },
  });

  revalidatePath("/canvassing");
  revalidatePath(`/canvassing/${listId}`);
  return {};
}

export async function rejectList(
  listId: string,
  reason: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !APPROVER_ROLES.includes(activeRole as Role)) {
    return { error: "You don't have permission to reject walk lists." };
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true, status: true, name: true },
  });
  if (!list) return { error: "Walk list not found." };
  if (list.status !== CanvassListStatus.pending_approval) {
    return { error: "This list is not pending approval." };
  }

  const trimmed = reason.trim();
  if (!trimmed) return { error: "Provide a reason for rejection." };

  await db.canvassList.update({
    where: { id: listId },
    data: { status: CanvassListStatus.draft, rejectionReason: trimmed },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "WALK_LIST_REJECTED",
    entityType: "canvass_list",
    entityId: listId,
    details: { name: list.name, reason: trimmed },
  });

  revalidatePath("/canvassing");
  revalidatePath(`/canvassing/${listId}`);
  return {};
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

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

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

  const ordered: EntryWithCoords[] = [];
  const unvisited = new Set(geocoded);

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

  const allOrdered = [...ordered.map((e) => e.id), ...ungeocodedIds];

  await db.$transaction(
    allOrdered.map((id, idx) =>
      db.canvassListEntry.update({ where: { id }, data: { sortOrder: idx } })
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

// ── Archive / Unarchive / Delete ─────────────────────────────────────────

export async function archiveList(listId: string): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canManageWalkLists(activeRole as Role)) {
    return { error: "You don't have permission to archive walk lists." };
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true, status: true, name: true },
  });
  if (!list) return { error: "Walk list not found." };
  if (list.status === CanvassListStatus.archived) return {};

  await db.canvassList.update({
    where: { id: listId },
    data: { status: CanvassListStatus.archived },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "WALK_LIST_ARCHIVED",
    entityType: "canvass_list",
    entityId: listId,
    details: { name: list.name },
  });

  revalidatePath("/canvassing");
  revalidatePath(`/canvassing/${listId}`);
  return {};
}

export async function unarchiveList(listId: string): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canManageWalkLists(activeRole as Role)) {
    return { error: "You don't have permission to manage walk lists." };
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true, status: true, name: true },
  });
  if (!list) return { error: "Walk list not found." };
  if (list.status !== CanvassListStatus.archived) return {};

  await db.canvassList.update({
    where: { id: listId },
    data: { status: CanvassListStatus.active },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "WALK_LIST_UNARCHIVED",
    entityType: "canvass_list",
    entityId: listId,
    details: { name: list.name },
  });

  revalidatePath("/canvassing");
  revalidatePath(`/canvassing/${listId}`);
  return {};
}

export async function deleteList(listId: string): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !["candidate", "campaign_manager", "data_manager"].includes(activeRole)) {
    return { error: "You don't have permission to delete walk lists." };
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!list) return { error: "Walk list not found." };

  const responseCount = await db.canvassResponse.count({
    where: { assignment: { canvassListId: listId } },
  });
  if (responseCount > 0) {
    return {
      error: `This list has ${responseCount} canvass ${responseCount === 1 ? "response" : "responses"}. Archive it instead to preserve the data.`,
    };
  }

  await db.canvassList.update({
    where: { id: listId },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "WALK_LIST_DELETED",
    entityType: "canvass_list",
    entityId: listId,
    details: { name: list.name },
  });

  revalidatePath("/canvassing");
  redirect("/canvassing");
}

// ── Edit list ─────────────────────────────────────────────────────────────

export async function updateListName(
  listId: string,
  name: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canAssignCanvassers(activeRole as Role)) {
    return { error: "You don't have permission to edit walk lists." };
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };
  if (trimmed.length > 120) return { error: "Name is too long." };

  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!list) return { error: "Walk list not found." };
  if (list.name === trimmed) return {};

  await db.canvassList.update({ where: { id: listId }, data: { name: trimmed } });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "WALK_LIST_RENAMED",
    entityType: "canvass_list",
    entityId: listId,
    details: { oldName: list.name, newName: trimmed },
  });

  revalidatePath(`/canvassing/${listId}`);
  return {};
}

export async function updateListFilters(
  listId: string,
  filters: DynamicFilters
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canAssignCanvassers(activeRole as Role)) {
    return { error: "You don't have permission to edit walk lists." };
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true, dynamicFilters: true },
  });
  if (!list) return { error: "Walk list not found." };
  if (!list.dynamicFilters) return { error: "This is not a dynamic list." };

  await db.canvassList.update({
    where: { id: listId },
    data: { dynamicFilters: filters as Prisma.InputJsonValue },
  });

  await _doRefresh(listId, activeCampaignId, session.user.id, filters);

  revalidatePath(`/canvassing/${listId}`);
  return {};
}

export async function removePersonFromList(
  listId: string,
  entryId: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canAssignCanvassers(activeRole as Role)) {
    return { error: "You don't have permission to edit walk lists." };
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const entry = await db.canvassListEntry.findFirst({
    where: {
      id: entryId,
      canvassList: { id: listId, campaignId: activeCampaignId },
      deletedAt: null,
    },
    select: { id: true, personId: true },
  });
  if (!entry) return { error: "Entry not found." };

  const responseCount = await db.canvassResponse.count({
    where: { personId: entry.personId, assignment: { canvassListId: listId } },
  });
  if (responseCount > 0) {
    return { error: "This person has canvass responses and cannot be removed." };
  }

  await db.canvassListEntry.update({
    where: { id: entryId },
    data: { deletedAt: new Date() },
  });

  revalidatePath(`/canvassing/${listId}`);
  return {};
}

export async function searchPeopleForList(
  listId: string,
  query: string
): Promise<{ id: string; firstName: string; lastName: string; addressLine: string }[]> {
  const session = await getServerSession(authOptions);
  if (!session) return [];

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId || !activeRole || !canAssignCanvassers(activeRole as Role)) return [];

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const inList = await db.canvassListEntry.findMany({
    where: { canvassListId: listId, deletedAt: null },
    select: { personId: true },
  });
  const inListIds = new Set(inList.map((e) => e.personId));

  const parts = trimmed.split(/\s+/);
  const orConditions: Prisma.PersonWhereInput[] =
    parts.length >= 2
      ? [
          {
            AND: [
              { firstName: { contains: parts[0], mode: "insensitive" } },
              { lastName: { contains: parts.slice(1).join(" "), mode: "insensitive" } },
            ],
          },
          {
            AND: [
              { lastName: { contains: parts[0], mode: "insensitive" } },
              { firstName: { contains: parts.slice(1).join(" "), mode: "insensitive" } },
            ],
          },
          { household: { address: { streetName: { contains: trimmed, mode: "insensitive" } } } },
        ]
      : [
          { firstName: { contains: trimmed, mode: "insensitive" } },
          { lastName: { contains: trimmed, mode: "insensitive" } },
          { household: { address: { streetName: { contains: trimmed, mode: "insensitive" } } } },
          { household: { address: { streetNumber: { contains: trimmed, mode: "insensitive" } } } },
        ];

  const people = await db.person.findMany({
    where: { campaignId: activeCampaignId, deletedAt: null, OR: orConditions },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      household: {
        select: {
          address: {
            select: { streetNumber: true, streetName: true, unitNumber: true, city: true },
          },
        },
      },
    },
    take: 8,
  });

  return people
    .filter((p) => !inListIds.has(p.id))
    .map((p) => {
      const addr = p.household?.address;
      const addressLine = addr
        ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}, ${addr.city}`
        : "Unknown address";
      return { id: p.id, firstName: p.firstName, lastName: p.lastName, addressLine };
    });
}

export async function addPersonToList(
  listId: string,
  personId: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canAssignCanvassers(activeRole as Role)) {
    return { error: "You don't have permission to edit walk lists." };
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const [person, list] = await Promise.all([
    db.person.findFirst({ where: { id: personId, campaignId: activeCampaignId, deletedAt: null }, select: { id: true } }),
    db.canvassList.findFirst({ where: { id: listId, campaignId: activeCampaignId, deletedAt: null }, select: { id: true } }),
  ]);
  if (!person) return { error: "Person not found." };
  if (!list) return { error: "Walk list not found." };

  const existing = await db.canvassListEntry.findFirst({
    where: { canvassListId: listId, personId },
  });

  if (existing) {
    if (existing.deletedAt) {
      await db.canvassListEntry.update({ where: { id: existing.id }, data: { deletedAt: null } });
    }
  } else {
    await db.canvassListEntry.create({
      data: { canvassListId: listId, personId, addedById: session.user.id },
    });
  }

  revalidatePath(`/canvassing/${listId}`);
  return {};
}

// ── Live filter match count ────────────────────────────────────────────────

export async function getFilterMatchCount(
  filters: DynamicFilters
): Promise<{ count: number } | { error: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canManageWalkLists(activeRole as Role)) {
    return { error: "Not authorized." };
  }

  const andConditions: Prisma.PersonWhereInput[] = [];

  if (filters.supportLevels?.length) {
    andConditions.push({
      canvassResponses: {
        some: { supportLevel: { in: filters.supportLevels as ("strong_yes" | "soft_yes" | "undecided" | "soft_no" | "strong_no")[] } },
      },
    });
  }

  if (filters.canvassStatus === "not_yet_canvassed") {
    andConditions.push({ canvassResponses: { none: {} } });
  } else if (filters.canvassStatus === "canvassed") {
    andConditions.push({ canvassResponses: { some: {} } });
  } else if (filters.canvassStatus === "not_home") {
    andConditions.push({ canvassResponses: { some: { outcome: "not_home" } } });
  }

  if (filters.tagIds?.length) {
    andConditions.push({ tags: { some: { tagId: { in: filters.tagIds } } } });
  }

  if (filters.wardStatuses?.length) {
    andConditions.push({ wardStatus: { in: filters.wardStatuses as WardStatus[] } });
  }

  const where: Prisma.PersonWhereInput = {
    campaignId: activeCampaignId,
    deletedAt: null,
    isOutOfDistrict: false,
    OR: [
      { includeInWalkLists: true },
      {
        AND: [
          { listSource: { notIn: [ListSource.manual, ListSource.team] } },
          { wardStatus: { notIn: [WardStatus.outside, WardStatus.pending_review] } },
        ],
      },
    ],
    ...(andConditions.length > 0 ? { AND: andConditions } : {}),
  };

  const count = await db.person.count({ where });
  return { count };
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

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const canvasserId = (formData.get("canvasserId") as string | null)?.trim();
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!canvasserId) return { error: "Select a canvasser." };

  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!list) return { error: "Walk list not found." };
  if (list.status === CanvassListStatus.pending_approval) {
    return { error: "This list is pending approval and cannot have canvassers assigned yet." };
  }

  const membership = await db.campaignMembership.findFirst({
    where: { userId: canvasserId, campaignId: activeCampaignId, deletedAt: null, role: { not: "finance_lead" as const } },
  });
  if (!membership) return { error: "User is not eligible to be assigned to this walk list." };

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
