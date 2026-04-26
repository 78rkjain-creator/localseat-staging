"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasMinimumRole } from "@/lib/permissions";
import { Role } from "@prisma/client";

export async function classifyPerson(
  personId: string,
  isOutOfDistrict: boolean
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeRole || !hasMinimumRole(activeRole as Role, Role.field_organizer)) {
    return { error: "Permission denied." };
  }

  const person = await db.person.findFirst({
    where: { id: personId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { error: "Person not found." };

  await db.person.update({
    where: { id: personId },
    data: {
      isOutOfDistrict,
      needsDistrictClassification: false,
      outOfDistrictApprovalStatus: isOutOfDistrict ? "pending" : null,
    },
  });

  revalidatePath("/people");
  return {};
}
