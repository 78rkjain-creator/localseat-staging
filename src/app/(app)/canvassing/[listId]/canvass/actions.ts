"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { CanvassOutcome, SupportLevel } from "@/types";

// ── Save canvass response ─────────────────────────────────────────────────

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

  const assignment = await db.canvassAssignment.findFirst({
    where: {
      id: input.assignmentId,
      canvasserId: session.user.id,
      canvassList: { campaignId: activeCampaignId },
    },
    select: { id: true },
  });
  if (!assignment) return { error: "Assignment not found." };

  const person = await db.person.findFirst({
    where: { id: input.personId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { error: "Person not found." };

  const isContacted = input.outcome === "contacted";

  const response = await db.canvassResponse.create({
    data: {
      assignmentId: input.assignmentId,
      personId: input.personId,
      outcome: input.outcome,
      supportLevel: isContacted ? input.supportLevel : null,
      signRequest: isContacted ? input.signRequest : false,
      volunteerInterest: isContacted ? input.volunteerInterest : false,
      donorInterest: isContacted ? input.donorInterest : false,
      notes: input.notes.trim() || null,
      needsFollowUp: input.needsFollowUp,
    },
    select: { id: true },
  });

  return { responseId: response.id };
}

// ── Add person at door ────────────────────────────────────────────────────

export async function addPersonAtDoor(input: {
  listId: string;
  assignmentId: string;
  firstName: string;
  lastName: string;
}): Promise<{
  error?: string;
  person?: { id: string; firstName: string; lastName: string; entryId: string };
}> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) return { error: "First and last name are required." };

  // Verify the assignment belongs to this canvasser and campaign
  const assignment = await db.canvassAssignment.findFirst({
    where: {
      id: input.assignmentId,
      canvasserId: session.user.id,
      canvassList: { campaignId: activeCampaignId, id: input.listId },
    },
    select: { id: true },
  });
  if (!assignment) return { error: "Assignment not found." };

  // Look up the field-entry system tag (tags are global, not campaign-scoped)
  const fieldEntryTag = await db.tag.findFirst({
    where: { name: "field-entry" },
    select: { id: true },
  });

  const result = await db.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: { firstName, lastName, campaignId: activeCampaignId },
    });

    if (fieldEntryTag) {
      await tx.personTag.create({
        data: { personId: person.id, tagId: fieldEntryTag.id },
      });
    }

    const entry = await tx.canvassListEntry.create({
      data: { canvassListId: input.listId, personId: person.id, addedById: session.user.id },
    });

    return { person, entry };
  });

  return {
    person: {
      id: result.person.id,
      firstName: result.person.firstName,
      lastName: result.person.lastName,
      entryId: result.entry.id,
    },
  };
}
