import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface PeopleListFilters {
  campaignId: string;
  q?: string;
  tagId?: string;
}

/**
 * Fetch a flat list of people for the list page.
 * Returns up to 50 results. Full pagination is a follow-up.
 */
export async function getPeopleList({ campaignId, q, tagId }: PeopleListFilters) {
  const people = await db.person.findMany({
    where: {
      campaignId,
      deletedAt: null,
      ...(q && q.trim().length > 0
        ? {
            OR: [
              { firstName: { contains: q.trim(), mode: "insensitive" } },
              { lastName: { contains: q.trim(), mode: "insensitive" } },
              { email: { contains: q.trim(), mode: "insensitive" } },
              { phone: { contains: q.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
      ...(tagId
        ? { tags: { some: { tagId } } }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
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
    take: 50,
  });

  return people;
}

export async function getPeopleCount(campaignId: string): Promise<number> {
  return db.person.count({ where: { campaignId, deletedAt: null } });
}

/**
 * Fetch all tags that exist in the campaign (via people in that campaign).
 * Used for the filter dropdown.
 */
export async function getCampaignTags(campaignId: string) {
  // Tags are global but we only show ones used in this campaign
  const rows = await db.personTag.findMany({
    where: { person: { campaignId, deletedAt: null } },
    select: { tag: { select: { id: true, name: true, color: true } } },
    distinct: ["tagId"],
  });
  return rows.map((r) => r.tag);
}

/**
 * Full person detail, including household, notes, canvass responses, outreach logs, tasks.
 */
export async function getPersonDetail(personId: string, campaignId: string) {
  const person = await db.person.findFirst({
    where: { id: personId, campaignId, deletedAt: null },
    include: {
      tags: { include: { tag: true } },
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
        },
        orderBy: { respondedAt: "desc" },
      },
      outreachLogs: {
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
      },
      tasks: {
        where: { completed: false },
        include: { assignee: { select: { firstName: true, lastName: true } } },
        orderBy: { dueDate: "asc" },
      },
      donorRecords: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return person;
}

// ── Voter list (paginated, management view) ────────────────────────────────

const VOTER_LIST_PAGE_SIZE = 100;

export interface VoterListFilters {
  campaignId: string;
  q?: string;
  street?: string;
  tagId?: string;
  page?: number;
}

export async function getVoterList({
  campaignId,
  q,
  street,
  tagId,
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
      { phone:     { contains: term, mode: "insensitive" } },
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

  const [people, total] = await Promise.all([
    db.person.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        birthYear: true,
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
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthYear: true,
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

export type PersonListItem = Awaited<ReturnType<typeof getPeopleList>>[number];
export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPersonDetail>>>;
