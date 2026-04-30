"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

const ALLOWED_ROLES = ["candidate", "campaign_manager", "field_organizer", "canvasser"] as const;

export async function saveSignature(data: {
  personId: string;
  consentTypeIds: string[];
  signatureData: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return;
  if (!ALLOWED_ROLES.includes(activeRole as typeof ALLOWED_ROLES[number])) return;
  if (!data.consentTypeIds || data.consentTypeIds.length === 0) return;

  // Verify person belongs to this campaign
  const person = await db.person.findFirst({
    where: { id: data.personId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return;

  // Verify all consent type IDs belong to this campaign
  const validTypes = await db.signatureConsentType.findMany({
    where: {
      id: { in: data.consentTypeIds },
      campaignId: activeCampaignId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (validTypes.length === 0) return;
  const validIds = validTypes.map((t) => t.id);

  const record = await db.signatureRecord.create({
    data: {
      personId: data.personId,
      campaignId: activeCampaignId,
      purpose: "",
      signatureData: data.signatureData,
      collectedById: session.user.id,
      consentItems: {
        create: validIds.map((id) => ({ consentTypeId: id })),
      },
    },
  });

  void record;

  revalidatePath(`/people/${data.personId}`);
}
