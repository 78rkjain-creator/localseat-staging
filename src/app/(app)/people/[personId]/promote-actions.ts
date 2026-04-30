"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { addTeamMember } from "@/app/(app)/team/actions";

export async function promoteVolunteerToUser(
  personId: string,
  role: string,
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (activeRole !== "candidate" && activeRole !== "campaign_manager" && activeRole !== "data_manager") {
    return { error: "Only the candidate or campaign manager may promote volunteers." };
  }

  const person = await db.person.findFirst({
    where: { id: personId, campaignId: activeCampaignId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneHome: true,
      phoneMobile: true,
      userId: true,
    },
  });

  if (!person) return { error: "Person not found." };
  if (person.userId) return { error: "This person already has a user account." };
  if (!person.email) return { error: "Cannot create a user account without an email address." };

  const result = await addTeamMember({
    email: person.email,
    firstName: person.firstName,
    lastName: person.lastName || "",
    role,
    phoneHome: person.phoneHome,
    phoneMobile: person.phoneMobile,
    skipVerification: false,
  });

  if (result.error) return { error: result.error };

  revalidatePath(`/people/${personId}`);
  revalidatePath("/people/team");
  revalidatePath("/people/volunteers");

  return {};
}
