"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageVoterList } from "@/lib/permissions";
import { sanitizePhone, sanitizeEmail, sanitizeBirthYear } from "@/lib/sanitize";
import { createAuditLog } from "@/lib/audit";
import type { Role } from "@/types";

// ── Auth guard ────────────────────────────────────────────────────────────

async function requireVoterListManager() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canManageVoterList(activeRole as Role)) {
    return { error: "You don't have permission to manage the voter list." } as const;
  }

  return { session, campaignId: activeCampaignId } as const;
}

// ── Import types ──────────────────────────────────────────────────────────

export interface VoterCsvRow {
  firstName: string;
  lastName: string;
  streetNumber: string;
  streetName: string;
  unitNumber: string;   // empty string when absent
  city: string;
  province: string;
  postalCode: string;
  phoneHome: string;    // empty string when absent
  phoneMobile: string;  // empty string when absent
  email: string;        // empty string when absent
  birthYear: string;    // empty string when absent
}

export interface VoterImportResult {
  error?: string;
  matched?: number;
  created?: number;
  skipped?: number;
}

// ── importVoterRows ───────────────────────────────────────────────────────

export async function importVoterRows(
  rows: VoterCsvRow[]
): Promise<VoterImportResult> {
  const auth = await requireVoterListManager();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows to import." };
  }
  if (rows.length > 2000) {
    return { error: "Maximum 2,000 rows per import." };
  }

  let matched = 0;
  let created = 0;
  let skipped = 0;

  await db.$transaction(
    async (tx) => {
      for (const row of rows) {
        const firstName   = row.firstName.trim();
        const lastName    = row.lastName.trim();
        const streetNumber = row.streetNumber.trim();
        const streetName  = row.streetName.trim();
        const city        = row.city.trim();
        const province    = row.province.trim();
        const postalCode  = row.postalCode.trim().replace(/\s/g, "").toUpperCase();
        const unitNumber  = row.unitNumber?.trim() || null;
        const phoneHome   = sanitizePhone(row.phoneHome);
        const phoneMobile = sanitizePhone(row.phoneMobile);
        const email       = sanitizeEmail(row.email);
        const birthYear   = sanitizeBirthYear(row.birthYear);

        if (!firstName || !lastName || !streetNumber || !streetName || !city || !province || !postalCode) {
          skipped++;
          continue;
        }

        // 1. Try to match an existing person by name + address
        const existingPerson = await tx.person.findFirst({
          where: {
            campaignId,
            deletedAt: null,
            firstName: { equals: firstName, mode: "insensitive" },
            lastName:  { equals: lastName,  mode: "insensitive" },
            household: {
              address: {
                streetNumber: { equals: streetNumber, mode: "insensitive" },
                streetName:   { equals: streetName,   mode: "insensitive" },
                unitNumber:   unitNumber
                  ? { equals: unitNumber, mode: "insensitive" }
                  : null,
                postalCode:   { equals: postalCode,   mode: "insensitive" },
              },
            },
          },
          select: { id: true },
        });

        if (existingPerson) {
          matched++;
          continue;
        }

        // 2. Find or create address
        let address = await tx.address.findFirst({
          where: {
            campaignId,
            deletedAt: null,
            streetNumber: { equals: streetNumber, mode: "insensitive" },
            streetName:   { equals: streetName,   mode: "insensitive" },
            unitNumber:   unitNumber
              ? { equals: unitNumber, mode: "insensitive" }
              : null,
            postalCode:   { equals: postalCode,   mode: "insensitive" },
          },
          select: { id: true },
        });

        if (!address) {
          address = await tx.address.create({
            data: { campaignId, streetNumber, streetName, unitNumber, city, province, postalCode },
            select: { id: true },
          });
        }

        // 3. Find or create household
        let household = await tx.household.findFirst({
          where: { campaignId, addressId: address.id, deletedAt: null },
          select: { id: true },
        });

        if (!household) {
          household = await tx.household.create({
            data: { campaignId, addressId: address.id },
            select: { id: true },
          });
        }

        // 4. Create person
        await tx.person.create({
          data: {
            campaignId,
            householdId: household.id,
            firstName,
            lastName,
            phoneHome:    phoneHome ?? undefined,
            phoneMobile:  phoneMobile ?? undefined,
            email:        email ?? undefined,
            birthYear:    birthYear ?? undefined,
            sourceNotes:  "voter-list-import",
          },
        });

        created++;
      }
    },
    { timeout: 60_000 }
  );

  revalidatePath("/voter-import");

  if (created > 0) {
    await createAuditLog({
      campaignId,
      userId: auth.session.user.id,
      action: "VOTER_IMPORT_COMPLETED",
      entityType: "person",
      details: { created, matched, skipped },
    });
  }

  return { matched, created, skipped };
}

// ── mergePersons ──────────────────────────────────────────────────────────

export async function mergePersons(input: {
  winnerId: string;
  loserId: string;
}): Promise<{ error?: string; ok?: boolean }> {
  const auth = await requireVoterListManager();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  if (input.winnerId === input.loserId) {
    return { error: "Cannot merge a record with itself." };
  }

  const [winner, loser] = await Promise.all([
    db.person.findFirst({
      where: { id: input.winnerId, campaignId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.person.findFirst({
      where: { id: input.loserId, campaignId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, tags: { select: { tagId: true } } },
    }),
  ]);

  if (!winner) return { error: "Winning record not found." };
  if (!loser)  return { error: "Record to merge away not found." };

  const outdatedTag = await db.tag.findFirst({
    where: { name: "record-outdated", deletedAt: null },
    select: { id: true },
  });

  const loserTagIds = loser.tags.map((t) => t.tagId);

  const winnerTags = await db.personTag.findMany({
    where: { personId: input.winnerId, deletedAt: null },
    select: { tagId: true },
  });
  const winnerTagIds = new Set(winnerTags.map((t) => t.tagId));

  await db.$transaction(async (tx) => {
    const tagsToTransfer = loserTagIds.filter((id) => !winnerTagIds.has(id));
    if (tagsToTransfer.length > 0) {
      await tx.personTag.createMany({
        data: tagsToTransfer.map((tagId) => ({
          personId: input.winnerId,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    if (outdatedTag) {
      await tx.personTag.upsert({
        where: {
          personId_tagId: { personId: input.loserId, tagId: outdatedTag.id },
        },
        create: { personId: input.loserId, tagId: outdatedTag.id },
        update: {},
      });
    }

    await tx.person.update({
      where: { id: input.loserId },
      data: { deletedAt: new Date() },
    });

    const loserName = `${loser.firstName} ${loser.lastName}`;
    await tx.note.create({
      data: {
        personId: input.winnerId,
        authorId: session.user.id,
        body: `Record merged: duplicate entry for ${loserName} (ID: ${input.loserId}) was removed and this record was kept as the primary.`,
      },
    });
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "PERSON_MERGED",
    entityType: "person",
    entityId: input.winnerId,
    details: { winnerId: input.winnerId, loserId: input.loserId },
  });

  revalidatePath("/voter-import");
  revalidatePath("/voter-import/duplicates");
  return { ok: true };
}
