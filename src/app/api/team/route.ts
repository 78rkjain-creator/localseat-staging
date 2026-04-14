import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { canManageTeam, canAssignCampaignManager } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import type { Role as AppRole } from "@/types";

// ── GET /api/team ─────────────────────────────────────────────────────────────
// candidate / campaign_manager: all members.
// field_organizer: canvasser and volunteer_coordinator members only.
// All other roles: 403.

const FIELD_ORGANIZER_VISIBLE_ROLES: Role[] = [Role.canvasser, Role.volunteer_coordinator];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return NextResponse.json({ error: "No active campaign" }, { status: 400 });

  const role = activeRole as Role | undefined;
  const isFullAccess = role === Role.candidate || role === Role.campaign_manager;
  const isFieldOrganizer = role === Role.field_organizer;

  if (!isFullAccess && !isFieldOrganizer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await db.campaignMembership.findMany({
    where: {
      campaignId: activeCampaignId,
      ...(isFieldOrganizer && { role: { in: FIELD_ORGANIZER_VISIBLE_ROLES } }),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    members.map((m) => ({
      membershipId: m.id,
      role: m.role,
      joinedAt: m.createdAt,
      user: m.user,
    }))
  );
}

// ── POST /api/team ────────────────────────────────────────────────────────────
// Adds a user to the campaign. Creates the user account if the email is new.
// Accessible to candidate and campaign_manager only.
// Only candidate may assign the campaign_manager role.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return NextResponse.json({ error: "No active campaign" }, { status: 400 });
  if (!activeRole || !canManageTeam(activeRole as AppRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, firstName, lastName, phone, role: roleInput } = body as Record<string, string | undefined>;

  if (!email || !firstName || !lastName || !roleInput) {
    // phone is intentionally excluded — it is optional
    return NextResponse.json(
      { error: "email, firstName, lastName, and role are required" },
      { status: 400 }
    );
  }

  // Validate role value
  if (!Object.values(Role).includes(roleInput as Role)) {
    return NextResponse.json({ error: `Invalid role: ${roleInput}` }, { status: 400 });
  }
  const role = roleInput as Role;

  // Only candidate may assign campaign_manager
  if (role === Role.campaign_manager && !canAssignCampaignManager(activeRole as AppRole)) {
    return NextResponse.json(
      { error: "Only the candidate may assign the campaign_manager role" },
      { status: 403 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Find or create the user
  let user = await db.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    const passwordHash = bcrypt.hashSync("password", 12);
    const normalizedPhone = phone?.trim() || null;
    user = await db.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(normalizedPhone !== null && { phone: normalizedPhone }),
      },
    });
  }

  // Check for existing membership
  const existing = await db.campaignMembership.findUnique({
    where: { userId_campaignId: { userId: user.id, campaignId: activeCampaignId } },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This user is already a member of the campaign" },
      { status: 409 }
    );
  }

  const membership = await db.campaignMembership.create({
    data: { userId: user.id, campaignId: activeCampaignId, role },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      membershipId: membership.id,
      role: membership.role,
      joinedAt: membership.createdAt,
      user: membership.user,
    },
    { status: 201 }
  );
}
