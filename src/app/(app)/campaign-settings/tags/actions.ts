"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTags } from "@/lib/permissions";
import { sanitizeText } from "@/lib/sanitize";
import type { Role } from "@/types";

async function requireManager() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeRole || !canManageTags(activeRole as Role)) {
    return { error: "Permission denied." } as const;
  }
  return { campaignId: activeCampaignId } as const;
}

export async function createTag(
  name: string,
  color: string | null
): Promise<{ error?: string; tag?: { id: string; name: string; color: string | null } }> {
  const auth = await requireManager();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  const trimmedName = sanitizeText(name, 50);
  if (!trimmedName) return { error: "Tag name is required (max 50 chars)." };

  const tagCount = await db.tag.count({ where: { campaignId, deletedAt: null } });
  if (tagCount >= 18) return { error: "Campaign tag limit (18) reached." };

  const existing = await db.tag.findFirst({
    where: { campaignId, name: { equals: trimmedName, mode: "insensitive" }, deletedAt: null },
    select: { id: true },
  });
  if (existing) return { error: "A tag with that name already exists." };

  const tag = await db.tag.create({
    data: { campaignId, name: trimmedName, color: color || null },
    select: { id: true, name: true, color: true },
  });

  revalidatePath("/campaign-settings/tags");
  return { tag };
}

export async function updateTag(
  tagId: string,
  name: string,
  color: string | null
): Promise<{ error?: string }> {
  const auth = await requireManager();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  const trimmedName = sanitizeText(name, 50);
  if (!trimmedName) return { error: "Tag name is required (max 50 chars)." };

  const tag = await db.tag.findFirst({
    where: { id: tagId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!tag) return { error: "Tag not found." };

  const conflict = await db.tag.findFirst({
    where: {
      campaignId,
      name: { equals: trimmedName, mode: "insensitive" },
      deletedAt: null,
      id: { not: tagId },
    },
    select: { id: true },
  });
  if (conflict) return { error: "A tag with that name already exists." };

  await db.tag.update({
    where: { id: tagId },
    data: { name: trimmedName, color: color || null },
  });

  revalidatePath("/campaign-settings/tags");
  return {};
}

export async function deleteTag(tagId: string): Promise<{ error?: string }> {
  const auth = await requireManager();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  const tag = await db.tag.findFirst({
    where: { id: tagId, campaignId, deletedAt: null },
    select: { id: true, _count: { select: { personTags: true } } },
  });
  if (!tag) return { error: "Tag not found." };
  if (tag._count.personTags > 0) {
    return { error: `Cannot delete — this tag is applied to ${tag._count.personTags} person${tag._count.personTags === 1 ? "" : "s"}.` };
  }

  await db.tag.delete({ where: { id: tagId } });

  revalidatePath("/campaign-settings/tags");
  return {};
}
