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
    select: { id: true, firstName: true, lastName: true },
  });
  if (!person) return { error: "Person not found." };

  const isContacted = input.outcome === "contacted";
  const noteText = input.notes.trim() || null;

  console.log("[saveCanvassResponse] needsFollowUp:", input.needsFollowUp, "| outcome:", input.outcome, "| person:", person.firstName, person.lastName);

  const response = await db.canvassResponse.create({
    data: {
      assignmentId: input.assignmentId,
      personId: input.personId,
      outcome: input.outcome,
      supportLevel: isContacted ? input.supportLevel : null,
      signRequest: isContacted ? input.signRequest : false,
      volunteerInterest: isContacted ? input.volunteerInterest : false,
      donorInterest: isContacted ? input.donorInterest : false,
      notes: noteText,
      needsFollowUp: input.needsFollowUp,
    },
    select: { id: true },
  });

  // Auto-log to outreach log — door_knock entry for every canvass save
  try {
    const outcomeLabel =
      input.outcome === "contacted" ? (input.supportLevel ? `Support: ${input.supportLevel}` : "Contacted") :
      input.outcome === "not_home" ? "Not home" :
      input.outcome === "refused" ? "Refused" :
      input.outcome === "moved" ? "Moved" :
      input.outcome === "unavailable" ? "Unavailable" :
      input.outcome === "deceased" ? "Deceased" : input.outcome;

    await db.outreachLog.create({
      data: {
        campaignId: activeCampaignId,
        personId: input.personId,
        userId: session.user.id,
        channel: "door_knock",
        date: new Date(),
        outcome: outcomeLabel,
        notes: noteText,
      },
    });
  } catch (err) {
    console.error("[saveCanvassResponse] Failed to auto-log outreach entry:", err);
  }

  // Task creation is independent of the canvass response — a task failure
  // must never roll back a canvass response that was successfully saved.
  if (input.needsFollowUp) {
    try {
      const canvasserName = `${session.user.firstName} ${session.user.lastName}`;
      const taskTitle = `Follow-up: ${person.firstName} ${person.lastName}`;
      // Prefix the canvasser's name so it's visible in the queue without
      // a schema change to Task (no createdById field on that model).
      const taskNotes = [`Flagged by ${canvasserName}`, noteText]
        .filter(Boolean)
        .join("\n\n");

      await db.task.create({
        data: {
          campaignId: activeCampaignId,
          personId: input.personId,
          title: taskTitle,
          notes: taskNotes,
          // No due date or assignee — managers assign from the queue
        },
      });
      console.log("[saveCanvassResponse] Task created for", taskTitle);
    } catch (err) {
      // Log but don't fail — canvass response is already saved
      console.error("[saveCanvassResponse] Failed to create follow-up task:", err);
    }
  }

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
