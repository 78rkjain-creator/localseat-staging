import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { canManageTeam, canAssignCampaignManager } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { sendWelcomeEmail, sendVerificationEmail } from "@/lib/email";
import { generateVerificationToken } from "@/lib/verification";
import bcrypt from "bcryptjs";
import crypto from "crypto";
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
      deletedAt: null,
      ...(isFieldOrganizer && { role: { in: FIELD_ORGANIZER_VISIBLE_ROLES } }),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneHome: true,
          phoneMobile: true,
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

  const { email, firstName, lastName, phoneHome, phoneMobile, role: roleInput, skipVerification: skipVerificationRaw } = body as Record<string, string | boolean | undefined>;
  const skipVerification = skipVerificationRaw === true || skipVerificationRaw === "true";

  if (!email || !firstName || !lastName || !roleInput) {
    // phoneHome is intentionally excluded — it is optional
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

  const normalizedEmail = (email as string).trim().toLowerCase();

  // Find or create the user
  let user = await db.user.findUnique({ where: { email: normalizedEmail } });

  const isNewUser = !user;

  let tempPassword: string | undefined;
  if (!user) {
    tempPassword = crypto.randomBytes(12).toString("base64url");
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const normalizedPhone = (phoneHome as string | undefined)?.trim() || null;
    const normalizedPhoneMobile = (phoneMobile as string | undefined)?.trim() || null;
    user = await db.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: (firstName as string).trim(),
        lastName: (lastName as string).trim(),
        ...(normalizedPhone !== null && { phoneHome: normalizedPhone }),
        ...(normalizedPhoneMobile !== null && { phoneMobile: normalizedPhoneMobile }),
        // Mark verified immediately if the manager chose to skip verification
        ...(skipVerification && { emailVerified: new Date() }),
      },
    });
  }

  // Check for existing active membership (soft-deleted memberships do not block re-adding)
  const existing = await db.campaignMembership.findFirst({
    where: { userId: user.id, campaignId: activeCampaignId, deletedAt: null },
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
          phoneHome: true,
          phoneMobile: true,
          isActive: true,
          createdAt: true,
        },
      },
      campaign: { select: { name: true } },
    },
  });

  // Email: welcome if skipping verification, verification email otherwise.
  // Only send to NEW users — existing users already have their email status.
  if (isNewUser) {
    if (skipVerification) {
      void sendWelcomeEmail({
        name: `${membership.user.firstName} ${membership.user.lastName}`,
        email: membership.user.email,
        campaignName: membership.campaign.name,
        role: membership.role,
        tempPassword,
      });
    } else {
      const verificationToken = await generateVerificationToken(user.id);
      void sendVerificationEmail({
        name: `${membership.user.firstName} ${membership.user.lastName}`,
        email: membership.user.email,
        token: verificationToken,
      });
    }
  }

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "MEMBER_ADDED",
    entityType: "campaign_membership",
    entityId: membership.id,
    details: { targetUserId: user.id, email: normalizedEmail, role },
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
