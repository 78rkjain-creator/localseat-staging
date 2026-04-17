import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { canManageTeam } from "@/lib/permissions";
import type { Role as AppRole } from "@/types";

// ── GET /api/team/removed ─────────────────────────────────────────────────────
// Returns soft-deleted campaign memberships. Accessible to candidate and
// campaign_manager only.

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return NextResponse.json({ error: "No active campaign" }, { status: 400 });
  if (!activeRole || !canManageTeam(activeRole as AppRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const removed = await db.campaignMembership.findMany({
    where: {
      campaignId: activeCampaignId,
      deletedAt: { not: null },
      // Never show the candidate role — they can't be removed anyway
      role: { not: Role.candidate },
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
        },
      },
    },
    orderBy: { deletedAt: "desc" },
  });

  return NextResponse.json(
    removed.map((m) => ({
      membershipId: m.id,
      role: m.role,
      removedAt: m.deletedAt,
      user: m.user,
    }))
  );
}
