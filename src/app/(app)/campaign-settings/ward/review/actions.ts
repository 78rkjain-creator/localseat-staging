"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import type { Role } from "@/types";

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "co_chair"];

async function requireWardReviewer() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    return { error: "You don't have permission to review ward flagged records." } as const;
  }

  return { session, campaignId: activeCampaignId } as const;
}

// ── Accept a single person (outside → outside_accepted) ───────────────────────

export async function acceptOutsidePerson(
  personId: string
): Promise<{ error?: string }> {
  const auth = await requireWardReviewer();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  const person = await db.person.findFirst({
    where: { id: personId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { error: "Person not found." };

  await db.person.update({
    where: { id: personId },
    data: { wardStatus: "outside_accepted" },
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "WARD_PERSON_ACCEPTED",
    entityType: "person",
    entityId: personId,
    details: { wardStatus: "outside_accepted" },
  });

  revalidatePath("/campaign-settings/ward/review");
  return {};
}

// ── Discard a single person (soft delete) ────────────────────────────────────

export async function discardOutsidePerson(
  personId: string
): Promise<{ error?: string }> {
  const auth = await requireWardReviewer();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  const person = await db.person.findFirst({
    where: { id: personId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { error: "Person not found." };

  await db.person.update({
    where: { id: personId },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "WARD_PERSON_DISCARDED",
    entityType: "person",
    entityId: personId,
    details: { wardStatus: "outside", discarded: true },
  });

  revalidatePath("/campaign-settings/ward/review");
  return {};
}

// ── Bulk accept all (outside / pending_review → outside_accepted) ─────────────

export async function acceptAllOutsidePersons(
  personIds: string[]
): Promise<{ error?: string }> {
  const auth = await requireWardReviewer();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  if (personIds.length === 0) return {};

  await db.person.updateMany({
    where: { id: { in: personIds }, campaignId, deletedAt: null },
    data: { wardStatus: "outside_accepted" },
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "WARD_BULK_ACCEPTED",
    entityType: "person",
    details: { count: personIds.length, wardStatus: "outside_accepted" },
  });

  revalidatePath("/campaign-settings/ward/review");
  return {};
}

// ── Bulk discard all (soft delete) ────────────────────────────────────────────

export async function discardAllOutsidePersons(
  personIds: string[]
): Promise<{ error?: string }> {
  const auth = await requireWardReviewer();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  if (personIds.length === 0) return {};

  await db.person.updateMany({
    where: { id: { in: personIds }, campaignId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "WARD_BULK_DISCARDED",
    entityType: "person",
    details: { count: personIds.length },
  });

  revalidatePath("/campaign-settings/ward/review");
  return {};
}
