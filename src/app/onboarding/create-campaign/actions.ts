"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";

interface CreateCampaignInput {
  name: string;
  ballotName?: string;
  officeSought?: string;
  municipality?: string;
  wardsInput?: string;
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

  const ballotName = input.ballotName?.trim() || null;
  const officeSought = input.officeSought?.trim() || null;
  const municipality = input.municipality?.trim() || null;
  const wards = (input.wardsInput ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
  const electionDate = input.electionDate ? new Date(input.electionDate) : null;
  const year = electionDate ? electionDate.getFullYear() : new Date().getFullYear();

  const campaign = await db.campaign.create({
    data: {
      name,
      ...(ballotName ? { ballotName } : {}),
      ...(officeSought ? { officeSought } : {}),
      ...(municipality ? { municipality, city: municipality } : { city: "" }),
      wards,
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

  await createAuditLog({
    campaignId: campaign.id,
    userId: session.user.id,
    action: "CAMPAIGN_CREATED",
    entityType: "campaign",
    entityId: campaign.id,
    details: { name, officeSought, municipality },
  });

  return { campaignId: campaign.id };
}
