import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTeam } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import type { Role as AppRole } from "@/types";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

// ── POST /api/team/[userId]/restore ───────────────────────────────────────────
// Restores the most recent soft-deleted membership for this user in the
// active campaign. Accessible to candidate and campaign_manager only.

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return NextResponse.json({ error: "No active campaign" }, { status: 400 });
  if (!activeRole || !canManageTeam(activeRole as AppRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  // Find the soft-deleted membership
  const membership = await db.campaignMembership.findFirst({
    where: { userId, campaignId: activeCampaignId, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });

  if (!membership) {
    return NextResponse.json({ error: "No removed membership found for this user" }, { status: 404 });
  }

  // Ensure no active membership exists (shouldn't happen, but guard it)
  const active = await db.campaignMembership.findFirst({
    where: { userId, campaignId: activeCampaignId, deletedAt: null },
  });
  if (active) {
    return NextResponse.json({ error: "This user already has an active membership" }, { status: 409 });
  }

  const restored = await db.campaignMembership.update({
    where: { id: membership.id },
    data: { deletedAt: null },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
      },
    },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "MEMBER_ADDED",
    entityType: "campaign_membership",
    entityId: restored.id,
    details: { targetUserId: userId, email: restored.user.email, role: restored.role, restored: true },
  });

  return NextResponse.json({
    membershipId: restored.id,
    role: restored.role,
    user: restored.user,
  });
}
