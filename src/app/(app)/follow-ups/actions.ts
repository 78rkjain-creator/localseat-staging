"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageFollowUps } from "@/lib/permissions";
import type { Role } from "@/types";

// ── Assign a task to a team member ─────────────────────────────────────────

export async function assignTask(
  taskId: string,
  assigneeId: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canManageFollowUps(activeRole as Role)) {
    return { error: "You don't have permission to assign tasks." };
  }

  const task = await db.task.findFirst({
    where: { id: taskId, campaignId: activeCampaignId },
    select: { id: true },
  });
  if (!task) return { error: "Task not found." };

  // Verify the assignee is a member of this campaign
  const membership = await db.campaignMembership.findFirst({
    where: { campaignId: activeCampaignId, userId: assigneeId },
    select: { userId: true },
  });
  if (!membership) return { error: "Assignee is not a member of this campaign." };

  await db.task.update({
    where: { id: taskId },
    data: { assignedTo: assigneeId },
  });

  revalidatePath("/follow-ups");
  return {};
}

// ── Mark a task as complete ────────────────────────────────────────────────

export async function completeTask(
  taskId: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };

  // Canvassers can only complete tasks assigned to them
  const whereClause =
    activeRole === "canvasser"
      ? { id: taskId, campaignId: activeCampaignId, assignedTo: session.user.id }
      : { id: taskId, campaignId: activeCampaignId };

  const task = await db.task.findFirst({
    where: whereClause,
    select: { id: true },
  });
  if (!task) return { error: "Task not found." };

  await db.task.update({
    where: { id: taskId },
    data: { completed: true, completedAt: new Date() },
  });

  revalidatePath("/follow-ups");
  revalidatePath("/dashboard");
  return {};
}

// ── Unassign a task (set back to unassigned) ──────────────────────────────

export async function unassignTask(
  taskId: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canManageFollowUps(activeRole as Role)) {
    return { error: "You don't have permission to unassign tasks." };
  }

  const task = await db.task.findFirst({
    where: { id: taskId, campaignId: activeCampaignId },
    select: { id: true },
  });
  if (!task) return { error: "Task not found." };

  await db.task.update({
    where: { id: taskId },
    data: { assignedTo: null },
  });

  revalidatePath("/follow-ups");
  return {};
}
