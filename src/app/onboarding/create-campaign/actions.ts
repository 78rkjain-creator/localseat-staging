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

  // Users creating their first campaign are candidates; users adding a
  // subsequent campaign (already have memberships) become campaign managers.
  const membershipRole =
    session.user.memberships && session.user.memberships.length > 0
      ? Role.campaign_manager
      : Role.candidate;

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
      plan: "starter",
      planActivated: false,
      advanceVotingDates: [],
      memberships: {
        create: {
          userId: session.user.id,
          role: membershipRole,
        },
      },
    },
  });

  await db.tag.createMany({
    data: [
      { campaignId: campaign.id, name: "Volunteer",      color: "#22c55e" },
      { campaignId: campaign.id, name: "Donor",          color: "#f97316" },
      { campaignId: campaign.id, name: "Endorser",       color: null      },
      { campaignId: campaign.id, name: "Sign location",  color: "#eab308" },
      { campaignId: campaign.id, name: "Do not contact", color: "#ef4444" },
      { campaignId: campaign.id, name: "Media",          color: null      },
      { campaignId: campaign.id, name: "VIP",            color: "#f97316" },
      { campaignId: campaign.id, name: "Influencer",     color: null      },
    ],
  });

  await db.signatureConsentType.createMany({
    data: [
      { campaignId: campaign.id, label: "Lawn sign consent", sortOrder: 0 },
      { campaignId: campaign.id, label: "Volunteer consent",  sortOrder: 1 },
      { campaignId: campaign.id, label: "Petition",           sortOrder: 2 },
      { campaignId: campaign.id, label: "Other",              sortOrder: 3 },
    ],
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
