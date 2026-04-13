"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { CanvassOutcome, SupportLevel } from "@/types";

export interface SaveResponseInput {
  assignmentId: string;
  personId: string;
  outcome: CanvassOutcome;
  supportLevel: SupportLevel | null;
  signRequest: boolean;
  volunteerInterest: boolean;
  donorInterest: boolean;
  notes: string;
  needsFollowUp: boolean;
}

export async function saveCanvassResponse(
  input: SaveResponseInput
): Promise<{ error?: string; responseId?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };

  // Verify this assignment belongs to the current user and campaign
  const assignment = await db.canvassAssignment.findFirst({
    where: {
      id: input.assignmentId,
      canvasserId: session.user.id,
      canvassList: { campaignId: activeCampaignId },
    },
    select: { id: true },
  });
  if (!assignment) return { error: "Assignment not found." };

  // Verify person belongs to this campaign
  const person = await db.person.findFirst({
    where: { id: input.personId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { error: "Person not found." };

  const response = await db.canvassResponse.create({
    data: {
      assignmentId: input.assignmentId,
      personId: input.personId,
      outcome: input.outcome,
      supportLevel: input.outcome === "contacted" ? input.supportLevel : null,
      signRequest: input.outcome === "contacted" ? input.signRequest : false,
      volunteerInterest: input.outcome === "contacted" ? input.volunteerInterest : false,
      donorInterest: input.outcome === "contacted" ? input.donorInterest : false,
      notes: input.notes.trim() || null,
      needsFollowUp: input.needsFollowUp,
    },
    select: { id: true },
  });

  return { responseId: response.id };
}
