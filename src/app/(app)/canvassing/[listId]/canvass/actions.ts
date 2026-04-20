"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { canAddConstituent } from "@/lib/plan-limits";
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
  /** Client-side timestamp (ms) from the offline queue. When present and within
   *  48 hours, used as respondedAt so door-knock times reflect when the canvasser
   *  was at the door, not when the sync ran. */
  queuedAt?: number;
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
      deletedAt: null,
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

  // Resolve respondedAt: use client-side queuedAt when provided and within 48h,
  // so offline door-knock times are preserved rather than reflecting sync time.
  const now = new Date();
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  let respondedAt = now;
  if (input.queuedAt) {
    const candidate = new Date(input.queuedAt);
    if (candidate.getTime() > now.getTime() - FORTY_EIGHT_HOURS_MS && candidate <= now) {
      respondedAt = candidate;
    } else {
      console.warn("[saveCanvassResponse] queuedAt out of range, falling back to server time:", input.queuedAt);
    }
  }

  // Check whether this is a new response or a retry — side effects (outreach log,
  // volunteer/donor records, tasks) only run on the first successful save.
  const existingResponse = await db.canvassResponse.findUnique({
    where: { assignmentId_personId: { assignmentId: input.assignmentId, personId: input.personId } },
    select: { id: true },
  });
  const isNewResponse = !existingResponse;

  const responseData = {
    outcome: input.outcome,
    supportLevel: isContacted ? input.supportLevel : null,
    signRequest: isContacted ? input.signRequest : false,
    volunteerInterest: isContacted ? input.volunteerInterest : false,
    donorInterest: isContacted ? input.donorInterest : false,
    notes: noteText,
    needsFollowUp: input.needsFollowUp,
    respondedAt,
  };

  const response = await db.canvassResponse.upsert({
    where: { assignmentId_personId: { assignmentId: input.assignmentId, personId: input.personId } },
    create: { assignmentId: input.assignmentId, personId: input.personId, ...responseData },
    update: responseData,
    select: { id: true },
  });

  if (!isNewResponse) {
    // Duplicate submission (retry/re-sync) — update accepted, skip side effects.
    return { responseId: response.id };
  }

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

  // Auto-create volunteer record when volunteer interest is flagged (idempotent)
  if (isContacted && input.volunteerInterest) {
    try {
      await db.volunteerRecord.upsert({
        where: { campaignId_personId: { campaignId: activeCampaignId, personId: input.personId } },
        create: {
          campaignId: activeCampaignId,
          personId: input.personId,
          status: "interested",
          notes: noteText,
        },
        update: {},
      });
    } catch (err) {
      console.error("[saveCanvassResponse] Failed to create volunteer record:", err);
    }
  }

  // Auto-create donor record when donor interest is flagged (idempotent)
  if (isContacted && input.donorInterest) {
    try {
      const existing = await db.donor.findFirst({
        where: { campaignId: activeCampaignId, linkedPersonId: input.personId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        await db.donor.create({
          data: {
            campaignId: activeCampaignId,
            firstName: person.firstName,
            lastName: person.lastName,
            linkedPersonId: input.personId,
            status: "interested",
            createdById: session.user.id,
            notes: noteText,
          },
        });
        console.log("[saveCanvassResponse] Donor record created for", person.firstName, person.lastName);
      }
    } catch (err) {
      console.error("[saveCanvassResponse] Failed to create donor record:", err);
    }
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

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "CANVASS_RESPONSE_SUBMITTED",
    entityType: "canvass_response",
    entityId: response.id,
    details: {
      personId: input.personId,
      assignmentId: input.assignmentId,
      outcome: input.outcome,
      supportLevel: input.supportLevel ?? null,
    },
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
      deletedAt: null,
      canvassList: { campaignId: activeCampaignId, id: input.listId },
    },
    select: { id: true },
  });
  if (!assignment) return { error: "Assignment not found." };

  // Plan limit check
  const currentCount = await db.person.count({ where: { campaignId: activeCampaignId, deletedAt: null } });
  const allowed = await canAddConstituent(activeCampaignId, currentCount);
  if (!allowed) {
    return { error: "Constituent limit reached. Contact your campaign manager." };
  }

  // Look up the field-entry system tag (tags are global, not campaign-scoped).
  // If the tag is missing (seed data not run or tag deleted) we refuse rather
  // than silently creating an untagged record that would be hard to identify.
  const fieldEntryTag = await db.tag.findFirst({
    where: { name: "field-entry", deletedAt: null },
    select: { id: true },
  });
  if (!fieldEntryTag) {
    return { error: "System setup incomplete: 'field-entry' tag not found. Please contact your campaign manager." };
  }

  const result = await db.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: { firstName, lastName, campaignId: activeCampaignId },
    });

    await tx.personTag.create({
      data: { personId: person.id, tagId: fieldEntryTag.id },
    });

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
