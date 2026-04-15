"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sanitizeEmail, sanitizePhone, sanitizeBirthYear, sanitizeEnum } from "@/lib/sanitize";
import type { SupportLevel } from "@/types";

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
  birthYear?: number | null;
  supportLevel?: SupportLevel | null;
}

export async function updatePerson(
  input: UpdatePersonInput
): Promise<{ error?: string; success?: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) {
    return { error: "Not authenticated." };
  }

  const campaignId = session.user.activeCampaignId;

  // Security check: verify person belongs to this campaign
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
      birthYear: sanitizeBirthYear(input.birthYear),
      supportLevel: sanitizeEnum(input.supportLevel, SUPPORT_LEVEL_VALUES),
    },
  });

  revalidatePath(`/people/${input.personId}`);
  return { success: true };
}

export async function addNote(
  personId: string,
  campaignId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };
  if (session.user.activeCampaignId !== campaignId) {
    return { error: "Access denied." };
  }

  const body = (formData.get("body") as string | null)?.trim();
  if (!body || body.length === 0) {
    return { error: "Note cannot be empty." };
  }
  if (body.length > 2000) {
    return { error: "Note is too long (max 2000 characters)." };
  }

  // Verify the person belongs to the campaign (tenant safety)
  const person = await db.person.findFirst({
    where: { id: personId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { error: "Person not found." };

  await db.note.create({
    data: {
      personId,
      authorId: session.user.id,
      body,
    },
  });

  revalidatePath(`/people/${personId}`);
  return {};
}
