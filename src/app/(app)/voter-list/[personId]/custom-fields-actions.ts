"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { Role } from "@/types";

const ALLOWED_ROLES: Role[] = [
  "candidate",
  "campaign_manager",
  "field_organizer",
];

export async function saveCustomFieldValues(
  personId: string,
  values: Record<string, string>
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Unauthorized" };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign" };
  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    return { error: "Forbidden" };
  }

  const person = await db.person.findFirst({
    where: { id: personId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { error: "Person not found" };

  // Full replacement — do not merge with existing. Keys absent from the incoming
  // values are intentionally removed, so blanking a field in the UI clears it.
  const cleaned = Object.fromEntries(
    Object.entries(values).filter(([, v]) => v.trim() !== "")
  );

  await db.person.update({
    where: { id: personId },
    data: { customFieldValues: Object.keys(cleaned).length > 0 ? cleaned : Prisma.DbNull },
  });

  revalidatePath(`/voter-list/${personId}`);
  return {};
}
