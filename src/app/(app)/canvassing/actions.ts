"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageWalkLists, canAssignCanvassers } from "@/lib/permissions";
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

  revalidatePath("/canvassing");
  redirect(`/canvassing/${list.id}`);
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
    where: { userId: canvasserId, campaignId: activeCampaignId, role: "canvasser" },
  });
  if (!membership) return { error: "User is not a canvasser in this campaign." };

  // Prevent duplicate assignment
  const existing = await db.canvassAssignment.findFirst({
    where: { canvassListId: listId, canvasserId },
  });
  if (existing) return { error: "This canvasser is already assigned to this list." };

  await db.canvassAssignment.create({
    data: { canvassListId: listId, canvasserId, notes },
  });

  revalidatePath(`/canvassing/${listId}`);
  return {};
}
