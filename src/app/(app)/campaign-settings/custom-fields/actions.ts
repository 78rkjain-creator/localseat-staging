"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { checkSupportWriteAccess } from "@/lib/support-access";
import type { Role } from "@/types";

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "data_manager"];

export interface CustomField {
  id: string;
  label: string;
}

export async function saveCustomFields(
  fields: CustomField[]
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Unauthorized" };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign" };
  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    return { error: "Forbidden" };
  }

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  const cleaned = fields
    .map((f) => ({ id: f.id, label: f.label.trim() }))
    .filter((f) => f.label);

  if (cleaned.length > 5) return { error: "Maximum 5 custom fields allowed." };

  const validIds = new Set(cleaned.map((f) => f.id));

  // Runs in a transaction so the definition update and the person value cleanup
  // are atomic. Cleanup runs on every save because a field deletion or id change
  // would otherwise leave stale keys on every person record in the campaign.
  await db.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id: activeCampaignId },
      data: { customFields: cleaned.length > 0 ? cleaned : Prisma.JsonNull },
    });

    if (validIds.size === 0) {
      // All fields removed — clear customFieldValues on every person in the campaign.
      await tx.person.updateMany({
        where: { campaignId: activeCampaignId, deletedAt: null },
        data: { customFieldValues: Prisma.DbNull },
      });
    } else {
      // Strip keys that are no longer in the definition from each person's stored values.
      const personsWithValues = await tx.person.findMany({
        where: { campaignId: activeCampaignId, deletedAt: null },
        select: { id: true, customFieldValues: true },
      });

      for (const person of personsWithValues) {
        const existing = person.customFieldValues as Record<string, string> | null;
        if (!existing) continue;

        const pruned = Object.fromEntries(
          Object.entries(existing).filter(([k]) => validIds.has(k))
        );

        await tx.person.update({
          where: { id: person.id },
          data: {
            customFieldValues:
              Object.keys(pruned).length > 0 ? pruned : Prisma.DbNull,
          },
        });
      }
    }
  });

  revalidatePath("/campaign-settings/custom-fields");
  return {};
}
