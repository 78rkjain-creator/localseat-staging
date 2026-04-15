"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageFollowUps } from "@/lib/permissions";
import type { OutreachChannel, Role } from "@/types";

// ── Auth guard ─────────────────────────────────────────────────────────────

async function requireOutreachManager() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canManageFollowUps(activeRole as Role)) {
    return { error: "You don't have permission to manage outreach logs." } as const;
  }

  return { session, campaignId: activeCampaignId } as const;
}

// ── Manual log entry ───────────────────────────────────────────────────────

export interface ManualLogInput {
  personId: string;
  channel: OutreachChannel;
  date: string; // ISO date string from <input type="date">
  outcome?: string;
  notes?: string;
}

export async function logOutreach(
  input: ManualLogInput
): Promise<{ error?: string }> {
  const auth = await requireOutreachManager();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  const person = await db.person.findFirst({
    where: { id: input.personId, campaignId, deletedAt: null },
    select: { id: true },
  });
  if (!person) return { error: "Person not found." };

  await db.outreachLog.create({
    data: {
      campaignId,
      personId: input.personId,
      userId: session.user.id,
      channel: input.channel,
      date: new Date(input.date),
      outcome: input.outcome?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath("/outreach");
  return {};
}

// ── Person search (for log entry modal) ───────────────────────────────────

export async function searchPeople(
  campaignId: string,
  query: string
): Promise<{ id: string; firstName: string; lastName: string; address: string }[]> {
  if (!query.trim() || query.trim().length < 2) return [];

  const term = query.trim();
  const people = await db.person.findMany({
    where: {
      campaignId,
      deletedAt: null,
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      household: {
        select: {
          address: {
            select: { streetNumber: true, streetName: true, city: true },
          },
        },
      },
    },
    take: 8,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return people.map((p) => {
    const addr = p.household?.address;
    const address = addr ? `${addr.streetNumber} ${addr.streetName}, ${addr.city}` : "";
    return { id: p.id, firstName: p.firstName, lastName: p.lastName, address };
  });
}

// ── Import results from phone/text provider ────────────────────────────────

export interface ImportedOutreachRow {
  firstName: string;
  lastName: string;
  address: string;
  phone?: string;
  channel: OutreachChannel;
  date: string;
  outcome?: string;
  notes?: string;
  phonedBy?: string;
  phoneType?: string;
}

export interface OutreachImportResult {
  imported: number;
  unmatched: { firstName: string; lastName: string; address: string }[];
  error?: string;
}

export async function importOutreachResults(
  rows: ImportedOutreachRow[]
): Promise<OutreachImportResult> {
  const auth = await requireOutreachManager();
  if ("error" in auth) return { imported: 0, unmatched: [], error: auth.error };
  const { session, campaignId } = auth;

  if (!Array.isArray(rows) || rows.length === 0) {
    return { imported: 0, unmatched: [], error: "No rows to import." };
  }

  let imported = 0;
  const unmatched: { firstName: string; lastName: string; address: string }[] = [];

  for (const row of rows) {
    // Try to match by phone first, then name
    let person: { id: string } | null = null;

    if (row.phone?.trim()) {
      person = await db.person.findFirst({
        where: {
          campaignId,
          deletedAt: null,
          OR: [
            { phoneHome: { contains: row.phone?.trim() ?? "" } },
            { phoneMobile: { contains: row.phone?.trim() ?? "" } },
          ],
        },
        select: { id: true },
      });
    }

    if (!person && row.firstName && row.lastName) {
      person = await db.person.findFirst({
        where: {
          campaignId,
          deletedAt: null,
          firstName: { equals: row.firstName.trim(), mode: "insensitive" },
          lastName: { equals: row.lastName.trim(), mode: "insensitive" },
        },
        select: { id: true },
      });
    }

    if (!person) {
      unmatched.push({
        firstName: row.firstName,
        lastName: row.lastName,
        address: row.address ?? "",
      });
      continue;
    }

    await db.outreachLog.create({
      data: {
        campaignId,
        personId: person.id,
        userId: session.user.id,
        channel: row.channel,
        date: row.date ? new Date(row.date) : new Date(),
        outcome: row.outcome?.trim() || null,
        notes: row.notes?.trim() || null,
        phonedBy: row.phonedBy?.trim() || null,
        phoneType: row.phoneType?.trim() || null,
      },
    });
    imported++;
  }

  revalidatePath("/outreach");
  return { imported, unmatched };
}
