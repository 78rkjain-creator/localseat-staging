"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageVoterList, hasMinimumRole } from "@/lib/permissions";
import { sanitizeEmail, sanitizePhone, sanitizeBirthDate, sanitizeEnum } from "@/lib/sanitize";
import { createAuditLog } from "@/lib/audit";
import type { SupportLevel } from "@/types";
import { Role } from "@prisma/client";

const SUPPORT_LEVEL_VALUES: SupportLevel[] = [
  "strong_yes", "soft_yes", "undecided", "soft_no", "strong_no", "not_home",
];

// ── Update person contact fields ──────────────────────────────────────────────

interface UpdatePersonInput {
  personId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneHome?: string;
  phoneMobile?: string;
  birthDate?: string | null;
  supportLevel?: SupportLevel | null;
  pollNumber?: string | null;
}

export async function updatePerson(
  input: UpdatePersonInput
): Promise<{ error?: string; success?: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) {
    return { error: "Not authenticated." };
  }

  const { activeCampaignId, activeRole } = session.user;
  if (!activeRole || !canManageVoterList(activeRole as Role)) {
    return { error: "Permission denied." };
  }

  const campaignId = activeCampaignId;

  const existing = await db.person.findFirst({
    where: { id: input.personId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return { error: "Person not found." };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    return { error: "First name and last name are required." };
  }

  await db.person.update({
    where: { id: input.personId },
    data: {
      firstName,
      lastName,
      email: sanitizeEmail(input.email),
      phoneHome: sanitizePhone(input.phoneHome),
      phoneMobile: sanitizePhone(input.phoneMobile),
      birthDate: sanitizeBirthDate(input.birthDate),
      supportLevel: sanitizeEnum(input.supportLevel, SUPPORT_LEVEL_VALUES),
      pollNumber: input.pollNumber?.trim() || null,
    },
  });

  revalidatePath(`/people/${input.personId}`);
  return { success: true };
}

// ── Add note ──────────────────────────────────────────────────────────────────

export async function addNote(
  personId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };
  const campaignId = session.user.activeCampaignId;
  if (!campaignId) return { error: "No active campaign." };

  const body = (formData.get("body") as string | null)?.trim();
  if (!body || body.length === 0) {
    return { error: "Note cannot be empty." };
  }
  if (body.length > 2000) {
    return { error: "Note is too long (max 2000 characters)." };
  }

  const person = await db.person.findFirst({
    where: { id: personId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { error: "Person not found." };

  await db.note.create({
    data: { personId, authorId: session.user.id, body },
  });

  revalidatePath(`/people/${personId}`);
  return {};
}

// ── Toggle includeInWalkLists ─────────────────────────────────────────────────

export async function toggleIncludeInWalkLists(
  personId: string
): Promise<{ error?: string; includeInWalkLists?: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeRole || !hasMinimumRole(activeRole as Role, Role.field_organizer)) {
    return { error: "Permission denied." };
  }

  const person = await db.person.findFirst({
    where: { id: personId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true, includeInWalkLists: true, listSource: true },
  });
  if (!person) return { error: "Person not found." };
  if (person.listSource !== "manual") return { error: "Only manual records can be toggled." };

  const next = !person.includeInWalkLists;
  await db.person.update({
    where: { id: personId },
    data: { includeInWalkLists: next },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "PERSON_WALK_LIST_OVERRIDE_TOGGLED",
    entityType: "person",
    entityId: personId,
    details: { includeInWalkLists: next },
  });

  revalidatePath(`/people/${personId}`);
  return { includeInWalkLists: next };
}

// ── Tag management ────────────────────────────────────────────────────────────

function canEditTags(role: Role): boolean {
  return hasMinimumRole(role, Role.field_organizer);
}

async function requireTagEditor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeRole || !canEditTags(activeRole as Role)) {
    return { error: "Permission denied." } as const;
  }
  return { session, campaignId: activeCampaignId } as const;
}

export async function addTagToPerson(
  personId: string,
  tagId: string
): Promise<{ error?: string }> {
  const auth = await requireTagEditor();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  const [person, tag] = await Promise.all([
    db.person.findFirst({ where: { id: personId, campaignId, deletedAt: null }, select: { id: true } }),
    db.tag.findFirst({ where: { id: tagId, campaignId, deletedAt: null }, select: { id: true, name: true } }),
  ]);
  if (!person) return { error: "Person not found." };
  if (!tag) return { error: "Tag not found." };

  await db.personTag.upsert({
    where: { personId_tagId: { personId, tagId } },
    update: { deletedAt: null },
    create: { personId, tagId },
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "PERSON_TAG_ADDED",
    entityType: "person",
    entityId: personId,
    details: { tagId, tagName: tag.name },
  });

  revalidatePath(`/people/${personId}`);
  return {};
}

export async function removeTagFromPerson(
  personId: string,
  tagId: string
): Promise<{ error?: string }> {
  const auth = await requireTagEditor();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  const person = await db.person.findFirst({
    where: { id: personId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { error: "Person not found." };

  await db.personTag.deleteMany({ where: { personId, tagId } });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "PERSON_TAG_REMOVED",
    entityType: "person",
    entityId: personId,
    details: { tagId },
  });

  revalidatePath(`/people/${personId}`);
  return {};
}
