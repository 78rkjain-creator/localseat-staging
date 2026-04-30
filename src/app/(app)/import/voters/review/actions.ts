"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export async function acceptListMemberships(ids: string[]): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  const allowed = ["candidate", "campaign_manager", "data_manager"];
  if (!activeRole || !allowed.includes(activeRole)) {
    throw new Error("Insufficient permissions");
  }

  if (ids.length === 0) return;

  // Verify all memberships belong to this campaign before updating
  const memberships = await db.personListMembership.findMany({
    where: { id: { in: ids }, campaignId: activeCampaignId, status: "pending_review" },
    select: { id: true, personId: true },
  });

  const verifiedIds = memberships.map((m) => m.id);
  const personIds = memberships.map((m) => m.personId);

  await db.$transaction([
    db.personListMembership.updateMany({
      where: { id: { in: verifiedIds } },
      data: { status: "accepted" },
    }),
    db.person.updateMany({
      where: { id: { in: personIds } },
      data: { isConfirmedVoter: true },
    }),
  ]);
}
