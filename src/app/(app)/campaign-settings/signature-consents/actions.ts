"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const CONSENT_TYPE_CAP = 6;
const ALLOWED_ROLES = ["candidate", "campaign_manager"] as const;

async function getAuthorizedCampaignId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!ALLOWED_ROLES.includes(activeRole as typeof ALLOWED_ROLES[number])) redirect("/dashboard");
  return activeCampaignId;
}

export async function addConsentType(label: string): Promise<{ error?: string }> {
  const campaignId = await getAuthorizedCampaignId();

  const trimmed = label.trim();
  if (!trimmed) return { error: "Label is required." };
  if (trimmed.length > 60) return { error: "Label must be 60 characters or fewer." };

  const existing = await db.signatureConsentType.findMany({
    where: { campaignId, deletedAt: null },
    select: { id: true, label: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  if (existing.length >= CONSENT_TYPE_CAP) {
    return { error: `Maximum of ${CONSENT_TYPE_CAP} consent types allowed.` };
  }

  const duplicate = existing.some(
    (t) => t.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) return { error: "A consent type with that label already exists." };

  const maxOrder = existing.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), -1);

  await db.signatureConsentType.create({
    data: { campaignId, label: trimmed, sortOrder: maxOrder + 1 },
  });

  revalidatePath("/campaign-settings/signature-consents");
  return {};
}

export async function deleteConsentType(id: string): Promise<{ error?: string }> {
  const campaignId = await getAuthorizedCampaignId();

  const type = await db.signatureConsentType.findFirst({
    where: { id, campaignId, deletedAt: null },
    select: { id: true, _count: { select: { consents: true } } },
  });
  if (!type) return { error: "Consent type not found." };
  if (type._count.consents > 0) {
    return { error: "Cannot delete a consent type that is in use. Remove all linked signatures first." };
  }

  await db.signatureConsentType.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/campaign-settings/signature-consents");
  return {};
}

export async function renameConsentType(id: string, label: string): Promise<{ error?: string }> {
  const campaignId = await getAuthorizedCampaignId();

  const trimmed = label.trim();
  if (!trimmed) return { error: "Label is required." };
  if (trimmed.length > 60) return { error: "Label must be 60 characters or fewer." };

  const type = await db.signatureConsentType.findFirst({
    where: { id, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!type) return { error: "Consent type not found." };

  const duplicate = await db.signatureConsentType.findFirst({
    where: {
      campaignId,
      deletedAt: null,
      label: { equals: trimmed, mode: "insensitive" },
      NOT: { id },
    },
    select: { id: true },
  });
  if (duplicate) return { error: "A consent type with that label already exists." };

  await db.signatureConsentType.update({ where: { id }, data: { label: trimmed } });

  revalidatePath("/campaign-settings/signature-consents");
  return {};
}
