"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageVoterList } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import type { Prisma, SupportLevel, CanvassOutcome, ListSource, Role } from "@prisma/client";

export interface PeopleListFilters {
  campaignId: string;
  q?: string;
  tagId?: string;
  supportFilter?: "supporting" | "undecided" | "not_supporting" | "not_contacted";
  contactedAfter?: string; // ISO date string
  customFieldFilters?: string[]; // field IDs — person must have a non-empty value for all of them (AND)
  listSource?: ListSource[]; // when provided and fewer than 5 values, filter to those sources
  isOutOfDistrict?: boolean;
  page?: number;
}

const PEOPLE_PAGE_SIZE = 50;

export async function getPeopleList({ campaignId, q, tagId, supportFilter, contactedAfter, customFieldFilters, listSource, isOutOfDistrict, page = 1 }: PeopleListFilters) {
  const andFilters: Prisma.PersonWhereInput[] = [];

  if (supportFilter === "supporting") {
    andFilters.push({
      canvassResponses: { some: { supportLevel: { in: ["strong_yes", "soft_yes"] as SupportLevel[] } } },
    });
  } else if (supportFilter === "undecided") {
    andFilters.push({
      canvassResponses: { some: { supportLevel: "undecided" as SupportLevel } },
    });
  } else if (supportFilter === "not_supporting") {
    andFilters.push({
      canvassResponses: {
        some: {
          OR: [
            { supportLevel: { in: ["soft_no", "strong_no"] as SupportLevel[] } },
            { outcome: "other_candidate" as unknown as CanvassOutcome },
          ],
        },
      },
    });
  } else if (supportFilter === "not_contacted") {
    andFilters.push({ canvassResponses: { none: {} } });
  }

  if (contactedAfter) {
    andFilters.push({
      canvassResponses: { some: { respondedAt: { gte: new Date(contactedAfter) } } },
    });
  }

  for (const fieldId of customFieldFilters ?? []) {
    andFilters.push({
      customFieldValues: { path: [fieldId], string_contains: "" },
    } as Prisma.PersonWhereInput);
  }

  if (listSource && listSource.length > 0 && listSource.length < 5) {
    andFilters.push({ listSource: { in: listSource } });
  }

  if (typeof isOutOfDistrict === "boolean") {
    andFilters.push({ isOutOfDistrict });
  }

  const where: Prisma.PersonWhereInput = {
    campaignId,
    deletedAt: null,
    ...(q && q.trim().length > 0
      ? {
          OR: [
            { firstName: { contains: q.trim(), mode: "insensitive" } },
            { lastName: { contains: q.trim(), mode: "insensitive" } },
            { email: { contains: q.trim(), mode: "insensitive" } },
            { phoneHome: { contains: q.trim(), mode: "insensitive" } },
            { phoneMobile: { contains: q.trim(), mode: "insensitive" } },
          ],
        }
      : {}),
    ...(tagId ? { tags: { some: { tagId } } } : {}),
    ...(andFilters.length > 0 ? { AND: andFilters } : {}),
  };

  const [people, total] = await Promise.all([
    db.person.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneHome: true,
        phoneMobile: true,
        listSource: true,
        userId: true,
        user: {
          select: {
            memberships: {
              where: { campaignId, deletedAt: null },
              select: { role: true },
              take: 1,
            },
          },
        },
        household: {
          select: {
            address: {
              select: {
                streetNumber: true,
                streetName: true,
                unitNumber: true,
                city: true,
              },
            },
          },
        },
        tags: {
          select: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        canvassResponses: {
          orderBy: { respondedAt: "desc" },
          take: 1,
          select: { supportLevel: true, outcome: true, respondedAt: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PEOPLE_PAGE_SIZE,
      take: PEOPLE_PAGE_SIZE,
    }),
    db.person.count({ where }),
  ]);

  return { people, total };
}

export async function getPeopleCount(campaignId: string): Promise<number> {
  return db.person.count({ where: { campaignId, deletedAt: null } });
}

/**
 * Fetch all tags belonging to this campaign.
 * Used for the filter dropdown.
 */
export async function getCampaignTags(campaignId: string) {
  return db.tag.findMany({
    where: { campaignId, deletedAt: null },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Full person detail, including household, notes, canvass responses, outreach logs, tasks.
 */
export async function getPersonDetail(personId: string, campaignId: string) {
  const person = await db.person.findFirst({
    where: { id: personId, campaignId, deletedAt: null },
    include: {
      tags: { where: { deletedAt: null }, include: { tag: true } },
      user: {
        select: {
          id: true,
          memberships: {
            where: { campaignId, deletedAt: null },
            select: { role: true },
            take: 1,
          },
        },
      },
      household: {
        include: {
          address: true,
          people: {
            where: { deletedAt: null, id: { not: personId } },
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      notes: {
        where: { deletedAt: null },
        include: { author: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      },
      canvassResponses: {
        include: {
          assignment: {
            include: {
              canvasser: { select: { firstName: true, lastName: true } },
              canvassList: { select: { name: true } },
            },
          },
          competitor: { select: { name: true } },
        },
        orderBy: { respondedAt: "desc" },
      },
      outreachLogs: {
        where: { deletedAt: null },
        select: {
          id: true,
          channel: true,
          date: true,
          outcome: true,
          notes: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { date: "desc" },
      },
      tasks: {
        where: { completed: false },
        include: { assignee: { select: { firstName: true, lastName: true } } },
        orderBy: { dueDate: "asc" },
      },
      linkedDonors: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, amount: true },
      },
    },
  });

  return person;
}

export async function getPendingOutOfDistrictCount(campaignId: string): Promise<number> {
  return db.person.count({
    where: {
      campaignId,
      deletedAt: null,
      outOfDistrictApprovalStatus: "pending",
    },
  });
}

// ── Voter list (paginated, management view) ────────────────────────────────

const VOTER_LIST_PAGE_SIZE = 100;

export interface VoterListFilters {
  campaignId: string;
  q?: string;
  street?: string;
  tagId?: string;
  listSource?: ListSource[];
  page?: number;
}

export async function getVoterList({
  campaignId,
  q,
  street,
  tagId,
  listSource,
  page = 1,
}: VoterListFilters) {
  const skip = (page - 1) * VOTER_LIST_PAGE_SIZE;

  const where: Prisma.PersonWhereInput = {
    campaignId,
    deletedAt: null,
  };

  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName:  { contains: term, mode: "insensitive" } },
      { email:     { contains: term, mode: "insensitive" } },
      { phoneHome: { contains: term, mode: "insensitive" } },
      { phoneMobile: { contains: term, mode: "insensitive" } },
    ];
  }

  if (street?.trim()) {
    where.household = {
      address: {
        streetName: { contains: street.trim(), mode: "insensitive" },
      },
    };
  }

  if (tagId) {
    where.tags = { some: { tagId } };
  }

  if (listSource && listSource.length > 0 && listSource.length < 5) {
    where.listSource = { in: listSource };
  }

  const [people, total] = await Promise.all([
    db.person.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneHome: true,
        phoneMobile: true,
        birthDate: true,
        listSource: true,
        includeInWalkLists: true,
        sourceNotes: true,
        createdAt: true,
        household: {
          select: {
            address: {
              select: {
                streetNumber: true,
                streetName: true,
                unitNumber: true,
                city: true,
                postalCode: true,
              },
            },
          },
        },
        tags: {
          select: { tag: { select: { id: true, name: true, color: true } } },
        },
        canvassResponses: {
          orderBy: { respondedAt: "desc" },
          take: 1,
          select: { supportLevel: true, outcome: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: VOTER_LIST_PAGE_SIZE,
    }),
    db.person.count({ where }),
  ]);

  return {
    people,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / VOTER_LIST_PAGE_SIZE)),
  };
}

// ── Duplicate pair detection ───────────────────────────────────────────────

export async function findDuplicatePairs(campaignId: string) {
  const people = await db.person.findMany({
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
      sourceNotes: true,
      createdAt: true,
      tags: {
        select: { tag: { select: { id: true, name: true, color: true } } },
      },
      household: {
        select: {
          address: {
            select: {
              streetNumber: true,
              streetName: true,
              unitNumber: true,
              city: true,
              postalCode: true,
            },
          },
        },
      },
    },
  });

  // Group by dedup key: firstName|lastName|streetNumber|streetName|postalCode
  type PersonRow = (typeof people)[number];
  const groups = new Map<string, PersonRow[]>();

  for (const p of people) {
    const addr = p.household?.address;
    if (!addr) continue; // can't match without address

    const key = [
      p.firstName.toLowerCase().trim(),
      p.lastName.toLowerCase().trim(),
      addr.streetNumber.toLowerCase().trim(),
      addr.streetName.toLowerCase().trim(),
      addr.postalCode.toLowerCase().replace(/\s/g, ""),
    ].join("|");

    const group = groups.get(key) ?? [];
    group.push(p);
    groups.set(key, group);
  }

  // Collect pairs from groups with 2+ members
  const pairs: [PersonRow, PersonRow][] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Emit sequential pairs: (0,1), (1,2), ...
    for (let i = 0; i < group.length - 1; i++) {
      pairs.push([group[i], group[i + 1]]);
      if (pairs.length >= 50) break;
    }
    if (pairs.length >= 50) break;
  }

  return pairs;
}

export type VoterListItem = Awaited<ReturnType<typeof getVoterList>>["people"][number];
export type DuplicatePair = Awaited<ReturnType<typeof findDuplicatePairs>>[number];

export type PersonListItem = Awaited<ReturnType<typeof getPeopleList>>["people"][number];
export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPersonDetail>>>;

// ── Merge persons ─────────────────────────────────────────────────────────────

export async function mergePersons(input: {
  winnerId: string;
  loserId: string;
}): Promise<{ error?: string; ok?: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };
  if (!activeRole || !canManageVoterList(activeRole as Role)) {
    return { error: "You don't have permission to manage the voter list." };
  }

  const campaignId = activeCampaignId;

  if (input.winnerId === input.loserId) {
    return { error: "Cannot merge a record with itself." };
  }

  try {
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
  if (!loser) return { error: "Record to merge away not found." };

  const outdatedTag = await db.tag.findFirst({
    where: { campaignId, name: "record-outdated", deletedAt: null },
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
        data: tagsToTransfer.map((tagId) => ({ personId: input.winnerId, tagId })),
        skipDuplicates: true,
      });
    }

    if (outdatedTag) {
      await tx.personTag.upsert({
        where: { personId_tagId: { personId: input.loserId, tagId: outdatedTag.id } },
        create: { personId: input.loserId, tagId: outdatedTag.id },
        update: {},
      });
    }

    await tx.person.update({ where: { id: input.loserId }, data: { deletedAt: new Date() } });

    await tx.note.create({
      data: {
        personId: input.winnerId,
        authorId: session.user.id,
        body: `Record merged: duplicate entry for ${loser.firstName} ${loser.lastName} (ID: ${input.loserId}) was removed and this record was kept as the primary.`,
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

  revalidatePath("/people");
  revalidatePath("/people/duplicates");
  return { ok: true };
  } catch {
    return { error: "Failed to merge records." };
  }
}
