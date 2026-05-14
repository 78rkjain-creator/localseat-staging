"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManageCampaign, canCanvass } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { recordPollStrike, undoPollStrike } from "@/lib/gotv";
import { checkSupportWriteAccess } from "@/lib/support-access";
import type { Role } from "@/types";
import type { PollStrikeType } from "@prisma/client";

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function requireCampaignManager() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canManageCampaign(activeRole as Role))
    return { error: "Permission denied." } as const;
  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! } as const;
  return { session, campaignId: activeCampaignId } as const;
}

async function requireCanvasser() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canCanvass(activeRole as Role))
    return { error: "Permission denied." } as const;
  return { session, campaignId: activeCampaignId } as const;
}

// ── Toggle GOTV mode ──────────────────────────────────────────────────────────

export async function toggleGotvMode(
  enabled: boolean
): Promise<{ error?: string }> {
  const auth = await requireCampaignManager();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  await db.campaign.update({
    where: { id: campaignId },
    data: { gotvModeEnabled: enabled },
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: enabled ? "gotv_mode_enabled" : "gotv_mode_disabled",
    entityType: "campaign",
    entityId: campaignId,
    details: {},
  });

  revalidatePath("/gotv");
  revalidatePath("/dashboard");
  revalidatePath("/canvassing");
  return {};
}

// ── Save vote target ──────────────────────────────────────────────────────────

export async function saveVoteTarget(
  target: number | null
): Promise<{ error?: string }> {
  const auth = await requireCampaignManager();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  await db.campaign.update({
    where: { id: campaignId },
    data: { voteTarget: target },
  });

  revalidatePath("/gotv");
  revalidatePath("/campaign-settings/general");
  return {};
}

// ── Record poll strike ────────────────────────────────────────────────────────

export async function strikePerson(
  personId: string,
  strikeType: PollStrikeType = "election_day",
  notes?: string
): Promise<{ error?: string }> {
  const auth = await requireCanvasser();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  // Verify person belongs to this campaign
  const person = await db.person.findFirst({
    where: { id: personId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { error: "Person not found." };

  await recordPollStrike(campaignId, personId, session.user.id, strikeType, notes);

  revalidatePath("/gotv");
  return {};
}

// ── Undo poll strike ──────────────────────────────────────────────────────────

export async function unstrikePerson(
  personId: string
): Promise<{ error?: string }> {
  const auth = await requireCanvasser();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  await undoPollStrike(campaignId, personId);

  revalidatePath("/gotv");
  return {};
}

// ── Generate GOTV chase list as a canvass list ────────────────────────────────

export async function generateChaseList(): Promise<{
  error?: string;
  listId?: string;
}> {
  const auth = await requireCampaignManager();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  // Find all supporters who haven't been poll-struck
  const supporters = await db.person.findMany({
    where: {
      campaignId,
      deletedAt: null,
      supportLevel: { in: ["strong_yes", "soft_yes"] },
      pollStrikes: { none: {} },
    },
    select: { id: true },
  });

  if (supporters.length === 0) {
    return { error: "No remaining supporters to chase. Everyone has voted!" };
  }

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });

  const list = await db.canvassList.create({
    data: {
      campaignId,
      name: `GOTV Chase — ${dateLabel}`,
      description: `Auto-generated chase list: ${supporters.length} supporters who haven't voted yet.`,
      status: "active",
      isGotvList: true,
    },
  });

  // Add all supporters as entries
  await db.canvassListEntry.createMany({
    data: supporters.map((p: { id: string }, i: number) => ({
      canvassListId: list.id,
      personId: p.id,
      addedById: session.user.id,
      sortOrder: i,
    })),
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "gotv_chase_list_generated",
    entityType: "canvass_list",
    entityId: list.id,
    details: { count: supporters.length },
  });

  revalidatePath("/gotv");
  revalidatePath("/canvassing");
  return { listId: list.id };
}

// ── Generate knock list from chase list (filtered by area) ────────────────────

export async function generateKnockList(
  streetFilter?: string
): Promise<{ error?: string; listId?: string }> {
  const auth = await requireCampaignManager();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  const where: Record<string, unknown> = {
    campaignId,
    deletedAt: null,
    supportLevel: { in: ["strong_yes", "soft_yes"] },
    pollStrikes: { none: {} },
  };

  // Optional street filter for targeted door-knocking
  if (streetFilter?.trim()) {
    where.household = {
      address: {
        streetName: { contains: streetFilter.trim(), mode: "insensitive" },
      },
    };
  }

  const people = await db.person.findMany({
    where,
    select: { id: true },
    orderBy: { lastName: "asc" },
  });

  if (people.length === 0) {
    return { error: "No supporters found matching your filter." };
  }

  const now = new Date();
  const timeLabel = now.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
  const suffix = streetFilter?.trim() ? ` — ${streetFilter.trim()}` : "";

  const list = await db.canvassList.create({
    data: {
      campaignId,
      name: `GOTV Knock ${timeLabel}${suffix}`,
      description: `Knock list: ${people.length} people to get to the polls.`,
      status: "active",
      isGotvList: true,
    },
  });

  await db.canvassListEntry.createMany({
    data: people.map((p: { id: string }, i: number) => ({
      canvassListId: list.id,
      personId: p.id,
      addedById: session.user.id,
      sortOrder: i,
    })),
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "gotv_knock_list_generated",
    entityType: "canvass_list",
    entityId: list.id,
    details: { count: people.length, streetFilter: streetFilter ?? null },
  });

  revalidatePath("/gotv");
  revalidatePath("/canvassing");
  return { listId: list.id };
}

// ── Haversine distance ────────────────────────────────────────────────────────

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

// ── Auto chase list generator ─────────────────────────────────────────────────

interface PersonWithCoords {
  id: string;
  lat: number | null;
  lng: number | null;
}

function nearestNeighborSort(people: PersonWithCoords[]): PersonWithCoords[] {
  const geocoded = people.filter((p): p is PersonWithCoords & { lat: number; lng: number } =>
    p.lat !== null && p.lng !== null
  );
  const ungeo = people.filter((p) => p.lat === null || p.lng === null);

  if (geocoded.length === 0) return people;

  const ordered: typeof geocoded = [];
  const remaining = new Set(geocoded);

  const first = geocoded[0];
  remaining.delete(first);
  ordered.push(first);

  while (remaining.size > 0) {
    const last = ordered[ordered.length - 1];
    let nearest = geocoded[0];
    let nearestDist = Infinity;

    for (const candidate of remaining) {
      const dist = haversineKm(last.lat, last.lng, candidate.lat, candidate.lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = candidate;
      }
    }

    remaining.delete(nearest);
    ordered.push(nearest);
  }

  return [...ordered, ...ungeo];
}

function clusterByProximity(
  people: PersonWithCoords[],
  maxPerCluster: number
): PersonWithCoords[][] {
  const sorted = nearestNeighborSort(people);
  const clusters: PersonWithCoords[][] = [];
  for (let i = 0; i < sorted.length; i += maxPerCluster) {
    const chunk = sorted.slice(i, i + maxPerCluster);
    clusters.push(nearestNeighborSort(chunk));
  }
  return clusters;
}

export async function generateAutoChaseListsAction(
  maxPerList: number
): Promise<{ error?: string; listsCreated?: number; totalPeople?: number }> {
  const auth = await requireCampaignManager();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  if (maxPerList < 5 || maxPerList > 500) {
    return { error: "Max per list must be between 5 and 500." };
  }

  const supporters = await db.person.findMany({
    where: {
      campaignId,
      deletedAt: null,
      supportLevel: { in: ["strong_yes", "soft_yes"] },
      pollStrikes: { none: {} },
    },
    select: {
      id: true,
      household: {
        select: {
          address: {
            select: { lat: true, lng: true },
          },
        },
      },
    },
  });

  if (supporters.length === 0) {
    return { error: "No remaining supporters to chase. Everyone has voted!" };
  }

  const peopleWithCoords: PersonWithCoords[] = supporters.map((s) => ({
    id: s.id,
    lat: s.household?.address?.lat ?? null,
    lng: s.household?.address?.lng ?? null,
  }));

  const clusters = clusterByProximity(peopleWithCoords, maxPerList);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  const timeLabel = now.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

  let listsCreated = 0;

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];

    const list = await db.canvassList.create({
      data: {
        campaignId,
        name: `GOTV Chase ${i + 1} — ${dateLabel} ${timeLabel}`,
        description: `Auto-generated: ${cluster.length} supporters, walk-optimized.`,
        status: "active",
        isGotvList: true,
      },
    });

    await db.canvassListEntry.createMany({
      data: cluster.map((p: PersonWithCoords, idx: number) => ({
        canvassListId: list.id,
        personId: p.id,
        addedById: session.user.id,
        sortOrder: idx,
      })),
    });

    listsCreated++;
  }

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "gotv_auto_chase_lists_generated",
    entityType: "campaign",
    entityId: campaignId,
    details: { listsCreated, totalPeople: supporters.length, maxPerList },
  });

  revalidatePath("/gotv");
  revalidatePath("/canvassing");
  return { listsCreated, totalPeople: supporters.length };
}
