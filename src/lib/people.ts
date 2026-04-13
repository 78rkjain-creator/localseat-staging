import { db } from "@/lib/db";

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

export type PersonListItem = Awaited<ReturnType<typeof getPeopleList>>[number];
export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPersonDetail>>>;
