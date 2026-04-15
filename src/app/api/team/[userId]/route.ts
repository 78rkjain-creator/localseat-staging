import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { canManageTeam, canAssignCampaignManager } from "@/lib/permissions";
import type { Role as AppRole } from "@/types";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

// ── Shared lookup ─────────────────────────────────────────────────────────────

async function resolveMembership(userId: string, campaignId: string) {
  return db.campaignMembership.findUnique({
    where: { userId_campaignId: { userId, campaignId } },
  });
}

// ── PATCH /api/team/[userId] ──────────────────────────────────────────────────
// Change a member's role and optionally update their phone number.
// Candidate and campaign_manager only.
// Only candidate may assign campaign_manager.
// Cannot change the candidate's role.

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return NextResponse.json({ error: "No active campaign" }, { status: 400 });
  if (!activeRole || !canManageTeam(activeRole as AppRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  const membership = await resolveMembership(userId, activeCampaignId);
  if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (membership.role === Role.candidate) {
    return NextResponse.json(
      { error: "The candidate role cannot be changed" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { role: roleInput, phoneHome, phoneMobile } = body as Record<string, string | undefined>;
  if (!roleInput) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }
  if (!Object.values(Role).includes(roleInput as Role)) {
    return NextResponse.json({ error: `Invalid role: ${roleInput}` }, { status: 400 });
  }
  const newRole = roleInput as Role;

  if (newRole === Role.candidate) {
    return NextResponse.json(
      { error: "Cannot assign the candidate role" },
      { status: 403 }
    );
  }

  if (newRole === Role.campaign_manager && !canAssignCampaignManager(activeRole as AppRole)) {
    return NextResponse.json(
      { error: "Only the candidate may assign the campaign_manager role" },
      { status: 403 }
    );
  }

  // Update the membership role, and optionally update the user's phone numbers
  // in the same request if the caller provides them.
  const normalizedPhoneHome = phoneHome?.trim();
  const normalizedPhoneMobile = phoneMobile?.trim();
  const phoneData: Record<string, string | null> = {};
  if (normalizedPhoneHome !== undefined) phoneData.phoneHome = normalizedPhoneHome || null;
  if (normalizedPhoneMobile !== undefined) phoneData.phoneMobile = normalizedPhoneMobile || null;

  const [updated] = await db.$transaction([
    db.campaignMembership.update({
      where: { userId_campaignId: { userId, campaignId: activeCampaignId } },
      data: { role: newRole },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phoneHome: true, phoneMobile: true },
        },
      },
    }),
    ...(Object.keys(phoneData).length > 0
      ? [db.user.update({ where: { id: userId }, data: phoneData })]
      : []),
  ]);

  return NextResponse.json({
    membershipId: updated.id,
    role: updated.role,
    user: updated.user,
  });
}

// ── DELETE /api/team/[userId] ─────────────────────────────────────────────────
// Remove a member from the campaign. Candidate and campaign_manager only.
// Cannot remove the candidate or yourself.

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeCampaignId, activeRole, id: callerId } = session.user;
  if (!activeCampaignId) return NextResponse.json({ error: "No active campaign" }, { status: 400 });
  if (!activeRole || !canManageTeam(activeRole as AppRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  if (userId === callerId) {
    return NextResponse.json({ error: "You cannot remove yourself from the campaign" }, { status: 403 });
  }

  const membership = await resolveMembership(userId, activeCampaignId);
  if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  if (membership.role === Role.candidate) {
    return NextResponse.json(
      { error: "The candidate cannot be removed from the campaign" },
      { status: 403 }
    );
  }

  await db.campaignMembership.delete({
    where: { userId_campaignId: { userId, campaignId: activeCampaignId } },
  });

  return new NextResponse(null, { status: 204 });
}
