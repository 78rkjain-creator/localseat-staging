"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { canManageVoterList } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import type { Role } from "@/types";
import type { SupportLevel, ListSource } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MatchField =
  | "firstName"
  | "lastName"
  | "birthDate"
  | "phoneHome"
  | "phoneMobile"
  | "email"
  | "address";

export interface DupPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneHome: string | null;
  phoneMobile: string | null;
  birthDate: string | null;   // ISO date string "YYYY-MM-DD"
  supportLevel: SupportLevel | null;
  listSource: ListSource;
  userId: string | null;
  createdAt: string;           // ISO string
  canvassCount: number;
  address: {
    streetNumber: string;
    streetName: string;
    unitNumber: string | null;
    city: string;
    province: string;
    postalCode: string;
  } | null;
  tags: Array<{ id: string; name: string; color: string | null }>;
}

export interface DuplicateGroup {
  records: DupPerson[];
  matchedFields: MatchField[];
}

export interface MergeFieldChoices {
  firstName?: "winner" | "loser";
  lastName?: "winner" | "loser";
  email?: "winner" | "loser";
  phoneHome?: "winner" | "loser";
  phoneMobile?: "winner" | "loser";
  birthDate?: "winner" | "loser";
  supportLevel?: "winner" | "loser";
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function requireAccess() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canManageVoterList(activeRole as Role))
    return { error: "Permission denied." } as const;
  return { session, campaignId: activeCampaignId } as const;
}

// ── Field value normalisation ─────────────────────────────────────────────────

function getFieldValue(person: DupPerson, field: MatchField): string | null {
  switch (field) {
    case "firstName": {
      const v = person.firstName.trim().toLowerCase();
      return v || null;
    }
    case "lastName": {
      const v = person.lastName.trim().toLowerCase();
      return v || null;
    }
    case "birthDate":
      return person.birthDate ?? null;
    case "phoneHome": {
      const v = (person.phoneHome ?? "").replace(/\D/g, "");
      return v || null;
    }
    case "phoneMobile": {
      const v = (person.phoneMobile ?? "").replace(/\D/g, "");
      return v || null;
    }
    case "email": {
      const v = (person.email ?? "").trim().toLowerCase();
      return v || null;
    }
    case "address": {
      if (!person.address) return null;
      const num = person.address.streetNumber.trim().toLowerCase();
      const name = person.address.streetName.trim().toLowerCase();
      return num && name ? `${num}||${name}` : null;
    }
  }
}

// ── findDuplicates ────────────────────────────────────────────────────────────

export async function findDuplicates(
  matchFields: MatchField[]
): Promise<{ error?: string; groups?: DuplicateGroup[] }> {
  const auth = await requireAccess();
  if ("error" in auth) return { error: auth.error };
  const { campaignId } = auth;

  if (matchFields.length < 2) {
    return { error: "Select at least 2 fields to match on." };
  }

  const raw = await db.person.findMany({
    where: { campaignId, deletedAt: null },
    take: 5000,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneHome: true,
      phoneMobile: true,
      birthDate: true,
      supportLevel: true,
      listSource: true,
      userId: true,
      createdAt: true,
      household: {
        select: {
          address: {
            select: {
              streetNumber: true,
              streetName: true,
              unitNumber: true,
              city: true,
              province: true,
              postalCode: true,
            },
          },
        },
      },
      tags: {
        where: { deletedAt: null },
        select: { tag: { select: { id: true, name: true, color: true } } },
      },
      _count: { select: { canvassResponses: true } },
    },
  });

  const people: DupPerson[] = raw.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phoneHome: p.phoneHome,
    phoneMobile: p.phoneMobile,
    birthDate: p.birthDate ? p.birthDate.toISOString().split("T")[0] : null,
    supportLevel: p.supportLevel,
    listSource: p.listSource,
    userId: p.userId,
    createdAt: p.createdAt.toISOString(),
    canvassCount: p._count.canvassResponses,
    address: p.household?.address ?? null,
    tags: p.tags.map((t) => t.tag),
  }));

  // Group by composite key of non-null selected field values.
  // Key format: "field1,field2,...::field1:val1||field2:val2||..."
  // Only fields with actual values participate in the key.
  // Records with different null patterns won't share a key, meaning
  // two records that both lack an email won't match on email.
  const buckets = new Map<string, { records: DupPerson[]; matchedFields: MatchField[] }>();

  for (const person of people) {
    const parts: string[] = [];
    const usedFields: MatchField[] = [];

    for (const field of matchFields) {
      const val = getFieldValue(person, field);
      if (val !== null) {
        parts.push(`${field}:${val}`);
        usedFields.push(field);
      }
    }

    // Require at least 2 selected fields to have values to avoid weak single-field matches
    if (usedFields.length < 2) continue;

    const key = `${usedFields.join(",")}::${parts.join("||")}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.records.push(person);
    } else {
      buckets.set(key, { records: [person], matchedFields: usedFields });
    }
  }

  const result: DuplicateGroup[] = [];
  for (const group of buckets.values()) {
    if (group.records.length >= 2) result.push(group);
  }

  // Sort by group size descending, then alphabetically
  result.sort((a, b) => {
    if (b.records.length !== a.records.length) return b.records.length - a.records.length;
    const aKey = `${a.records[0].lastName}${a.records[0].firstName}`.toLowerCase();
    const bKey = `${b.records[0].lastName}${b.records[0].firstName}`.toLowerCase();
    return aKey.localeCompare(bKey);
  });

  return { groups: result.slice(0, 100) };
}

// ── mergeDuplicateRecords ─────────────────────────────────────────────────────

export async function mergeDuplicateRecords(input: {
  winnerId: string;
  loserId: string;
  fieldChoices: MergeFieldChoices;
}): Promise<{ error?: string; ok?: boolean }> {
  const auth = await requireAccess();
  if ("error" in auth) return { error: auth.error };
  const { session, campaignId } = auth;

  if (input.winnerId === input.loserId)
    return { error: "Cannot merge a record with itself." };

  try {
    const [winner, loser] = await Promise.all([
      db.person.findFirst({
        where: { id: input.winnerId, campaignId, deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneHome: true,
          phoneMobile: true,
          birthDate: true,
          supportLevel: true,
          userId: true,
          tags: { where: { deletedAt: null }, select: { tagId: true } },
        },
      }),
      db.person.findFirst({
        where: { id: input.loserId, campaignId, deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phoneHome: true,
          phoneMobile: true,
          birthDate: true,
          supportLevel: true,
          userId: true,
          tags: { where: { deletedAt: null }, select: { tagId: true } },
        },
      }),
    ]);

    if (!winner) return { error: "Primary record not found." };
    if (!loser) return { error: "Secondary record not found." };

    // Build winner update data from field choices; secondary fills blanks on primary
    type MergeKey = keyof MergeFieldChoices;
    const mergeableFields: MergeKey[] = [
      "firstName", "lastName", "email", "phoneHome", "phoneMobile", "birthDate", "supportLevel",
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of mergeableFields) {
      const choice = input.fieldChoices[field];
      if (choice) {
        const src = choice === "loser" ? loser : winner;
        updateData[field] = (src as Record<string, unknown>)[field];
      } else {
        // No explicit choice: fill from loser only when winner's value is blank
        const winnerVal = (winner as Record<string, unknown>)[field];
        const loserVal = (loser as Record<string, unknown>)[field];
        if ((winnerVal === null || winnerVal === undefined || winnerVal === "") && loserVal != null && loserVal !== "") {
          updateData[field] = loserVal;
        }
      }
    }

    // userId is handled inside the transaction to avoid @@unique([campaignId, userId]) violation

    const winnerTagIds = new Set(winner.tags.map((t) => t.tagId));
    const loserTagIds = loser.tags.map((t) => t.tagId).filter((id) => !winnerTagIds.has(id));

    const outdatedTag = await db.tag.findFirst({
      where: { campaignId, name: "record-outdated", deletedAt: null },
      select: { id: true },
    });

    await db.$transaction(async (tx) => {
      // Clear loser's userId first to avoid @@unique([campaignId, userId]) violation.
      // Only after clearing can we safely transfer it to winner (if winner has none).
      if (loser.userId) {
        await tx.person.update({ where: { id: loser.id }, data: { userId: null } });
        if (!winner.userId) updateData.userId = loser.userId;
      }

      // Apply field choices + userId transfer to winner
      await tx.person.update({ where: { id: winner.id }, data: updateData });

      // Transfer tags from loser → winner (upsert to handle soft-deleted existing rows)
      for (const tagId of loserTagIds) {
        await tx.personTag.upsert({
          where: { personId_tagId: { personId: winner.id, tagId } },
          create: { personId: winner.id, tagId },
          update: { deletedAt: null },
        });
      }

      // Tag the loser as outdated
      if (outdatedTag) {
        await tx.personTag.upsert({
          where: { personId_tagId: { personId: loser.id, tagId: outdatedTag.id } },
          create: { personId: loser.id, tagId: outdatedTag.id },
          update: {},
        });
      }

      // Transfer canvass responses
      await tx.canvassResponse.updateMany({
        where: { personId: loser.id },
        data: { personId: winner.id },
      });

      // Transfer outreach logs
      await tx.outreachLog.updateMany({
        where: { personId: loser.id },
        data: { personId: winner.id },
      });

      // Transfer tasks
      await tx.task.updateMany({
        where: { personId: loser.id },
        data: { personId: winner.id },
      });

      // Transfer non-deleted notes
      await tx.note.updateMany({
        where: { personId: loser.id, deletedAt: null },
        data: { personId: winner.id },
      });

      // Transfer survey responses
      await tx.surveyResponse.updateMany({
        where: { personId: loser.id },
        data: { personId: winner.id },
      });

      // Transfer signature records
      await tx.signatureRecord.updateMany({
        where: { personId: loser.id },
        data: { personId: winner.id },
      });

      // Transfer voting records
      await tx.votingRecord.updateMany({
        where: { personId: loser.id },
        data: { personId: winner.id },
      });

      // Transfer linked donors (nullable FK, no unique constraint)
      await tx.donor.updateMany({
        where: { linkedPersonId: loser.id },
        data: { linkedPersonId: winner.id },
      });

      // Transfer voter change requests (nullable FK)
      await tx.voterChangeRequest.updateMany({
        where: { personId: loser.id },
        data: { personId: winner.id },
      });

      // Transfer canvass list entries — unique([canvassListId, personId]) requires conflict check
      const [winnerEntries, loserEntries] = await Promise.all([
        tx.canvassListEntry.findMany({
          where: { personId: winner.id, deletedAt: null },
          select: { canvassListId: true },
        }),
        tx.canvassListEntry.findMany({
          where: { personId: loser.id, deletedAt: null },
          select: { id: true, canvassListId: true },
        }),
      ]);
      const winnerListIds = new Set(winnerEntries.map((e) => e.canvassListId));
      for (const entry of loserEntries) {
        if (winnerListIds.has(entry.canvassListId)) {
          // Winner already on this list — soft-delete the duplicate entry
          await tx.canvassListEntry.update({
            where: { id: entry.id },
            data: { deletedAt: new Date() },
          });
        } else {
          await tx.canvassListEntry.update({
            where: { id: entry.id },
            data: { personId: winner.id },
          });
          winnerListIds.add(entry.canvassListId);
        }
      }

      // Transfer volunteer record — unique([campaignId, personId]) requires conflict check
      const winnerVolRecord = await tx.volunteerRecord.findFirst({
        where: { personId: winner.id, campaignId },
        select: { id: true },
      });
      if (winnerVolRecord) {
        // Winner already has a volunteer record — soft-delete loser's
        await tx.volunteerRecord.updateMany({
          where: { personId: loser.id },
          data: { deletedAt: new Date() },
        });
      } else {
        await tx.volunteerRecord.updateMany({
          where: { personId: loser.id },
          data: { personId: winner.id },
        });
      }

      // Transfer list memberships — unique([personId, listImportId]) requires conflict check
      const loserMemberships = await tx.personListMembership.findMany({
        where: { personId: loser.id },
        select: { id: true, listImportId: true },
      });
      for (const m of loserMemberships) {
        const conflict = await tx.personListMembership.findFirst({
          where: { personId: winner.id, listImportId: m.listImportId },
          select: { id: true },
        });
        if (!conflict) {
          await tx.personListMembership.update({
            where: { id: m.id },
            data: { personId: winner.id },
          });
        }
      }

      // Soft-delete the loser
      await tx.person.update({
        where: { id: loser.id },
        data: { deletedAt: new Date() },
      });

      // Audit note on winner
      await tx.note.create({
        data: {
          personId: winner.id,
          authorId: session.user.id,
          body: `Merged: absorbed ${loser.firstName} ${loser.lastName} (ID …${loser.id.slice(-6)}) into this record.`,
        },
      });
    });

    await createAuditLog({
      campaignId,
      userId: session.user.id,
      action: "PERSON_MERGED",
      entityType: "person",
      entityId: winner.id,
      details: { winnerId: winner.id, loserId: loser.id },
    });

    revalidatePath("/people/duplicates");
    revalidatePath("/people");
    return { ok: true };
  } catch (e) {
    console.error("mergeDuplicateRecords error:", e);
    const detail = e instanceof Error ? e.message : String(e);
    return { error: `Merge failed: ${detail.slice(0, 300)}` };
  }
}
