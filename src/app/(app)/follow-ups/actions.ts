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

  try {
    const task = await db.task.findFirst({
      where: { id: taskId, campaignId: activeCampaignId, deletedAt: null },
      select: { id: true },
    });
    if (!task) return { error: "Task not found." };

    const membership = await db.campaignMembership.findFirst({
      where: { campaignId: activeCampaignId, userId: assigneeId, deletedAt: null },
      select: { userId: true },
    });
    if (!membership) return { error: "Assignee is not a member of this campaign." };

    await db.task.update({
      where: { id: taskId },
      data: { assignedTo: assigneeId },
    });

    revalidatePath("/follow-ups");
    return {};
  } catch {
    return { error: "Failed to assign task." };
  }
}

// ── Mark a task as complete ────────────────────────────────────────────────

export async function completeTask(
  taskId: string
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };

  const whereClause =
    activeRole === "canvasser"
      ? { id: taskId, campaignId: activeCampaignId, assignedTo: session.user.id, deletedAt: null }
      : { id: taskId, campaignId: activeCampaignId, deletedAt: null };

  try {
    const task = await db.task.findFirst({ where: whereClause, select: { id: true } });
    if (!task) return { error: "Task not found." };

    await db.task.update({
      where: { id: taskId },
      data: { completed: true, completedAt: new Date() },
    });

    revalidatePath("/follow-ups");
    revalidatePath("/dashboard");
    return {};
  } catch {
    return { error: "Failed to complete task." };
  }
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

  try {
    const task = await db.task.findFirst({
      where: { id: taskId, campaignId: activeCampaignId, deletedAt: null },
      select: { id: true },
    });
    if (!task) return { error: "Task not found." };

    await db.task.update({ where: { id: taskId }, data: { assignedTo: null } });

    revalidatePath("/follow-ups");
    return {};
  } catch {
    return { error: "Failed to unassign task." };
  }
}
