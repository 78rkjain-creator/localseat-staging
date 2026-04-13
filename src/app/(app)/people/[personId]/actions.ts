"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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
