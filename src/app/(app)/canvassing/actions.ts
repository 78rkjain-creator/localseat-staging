"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageWalkLists, canAssignCanvassers } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { geocodeAddressesForCanvassList } from "@/lib/geocoding";
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

  // Find all people linked to the selected addresses via Household
  const people = await db.person.findMany({
    where: {
      campaignId: activeCampaignId,
      deletedAt: null,
      household: {
        addressId: { in: data.addressIds },
        deletedAt: null,
      },
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
