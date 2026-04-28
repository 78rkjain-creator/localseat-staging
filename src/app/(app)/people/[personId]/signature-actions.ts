"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

const ALLOWED_ROLES = ["candidate", "campaign_manager", "field_organizer", "canvasser"] as const;

export async function saveSignature(data: {
  personId: string;
  purpose: string;
  signatureData: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return;
  if (!ALLOWED_ROLES.includes(activeRole as typeof ALLOWED_ROLES[number])) return;

  // Verify person belongs to this campaign
  const person = await db.person.findFirst({
    where: { id: data.personId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return;

  await db.signatureRecord.create({
    data: {
      personId: data.personId,
      campaignId: activeCampaignId,
      purpose: data.purpose,
      signatureData: data.signatureData,
      collectedById: session.user.id,
    },
  });

  revalidatePath(`/people/${data.personId}`);
}
