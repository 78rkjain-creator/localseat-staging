"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/lib/audit";
import { Prisma } from "@prisma/client";

export async function anonymizePerson(personId: string): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (activeRole !== "candidate" && activeRole !== "campaign_manager" && activeRole !== "data_manager") {
    return { error: "Not authorized." };
  }

  const person = await db.person.findFirst({
    where: {
      id: personId,
      campaignId: activeCampaignId,
      deletedAt: null,
      anonymizedAt: null,
    },
    select: { id: true },
  });
  if (!person) return { error: "Person not found or already anonymized." };

  await db.person.update({
    where: { id: personId },
    data: {
      firstName: "Anonymized",
      lastName: "Record",
      phoneHome: null,
      phoneMobile: null,
      email: null,
      birthDate: null,
      customFieldValues: Prisma.DbNull,
      anonymizedAt: new Date(),
    },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "PERSON_ANONYMIZED",
    entityType: "person",
    entityId: personId,
    details: { performedBy: session.user.id },
  });

  revalidatePath(`/people/${personId}`);
  return {};
}
