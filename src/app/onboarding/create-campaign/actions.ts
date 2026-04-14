"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";

interface CreateCampaignInput {
  name: string;
  municipality?: string;
  ward?: string;
  electionDate?: string;
}

export async function createCampaign(
  input: CreateCampaignInput
): Promise<{ error?: string; campaignId?: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Not authenticated." };
  }

  const name = input.name.trim();
  if (!name) {
    return { error: "Campaign name is required." };
  }

  const municipality = input.municipality?.trim() || null;
  const ward = input.ward?.trim() || null;
  const electionDate = input.electionDate ? new Date(input.electionDate) : null;
  const year = electionDate ? electionDate.getFullYear() : new Date().getFullYear();

  const campaign = await db.campaign.create({
    data: {
      name,
      ...(municipality ? { municipality, city: municipality } : { city: "" }),
      ...(ward ? { ward } : {}),
      province: "ON",
      year,
      ...(electionDate ? { electionDate } : {}),
      memberships: {
        create: {
          userId: session.user.id,
          role: Role.candidate,
        },
      },
    },
  });

  return { campaignId: campaign.id };
}
