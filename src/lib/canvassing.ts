import { db } from "@/lib/db";
import { ListSource, WardStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { SupportLevel } from "@/types";

// ── Dynamic filter shape (stored as JSON on CanvassList.dynamicFilters) ────

export interface DynamicFilters {
  supportLevels?: string[];
  tagIds?: string[];
  canvassStatus?: "not_yet_canvassed" | "canvassed" | "not_home" | "";
  wardStatuses?: string[];
}

// ── Walk list index ────────────────────────────────────────────────────────

export async function getCanvassLists(campaignId: string) {
  const lists = await db.canvassList.findMany({
    where: { campaignId, deletedAt: null },
    include: {
      assignments: {
        where: { deletedAt: null },
        include: {
          canvasser: { select: { id: true, firstName: true, lastName: true } },
          responses: { select: { personId: true } },
        },
      },
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return lists.map((list) => {
    const allPersonIds = list.assignments.flatMap((a) =>
      a.responses.map((r) => r.personId)
    );
    const totalResponses = new Set(allPersonIds).size;
    return { ...list, totalResponses, totalEntries: list._count.entries };
  });
}

// ── Walk list detail ───────────────────────────────────────────────────────

export async function getCanvassListDetail(listId: string, campaignId: string) {
  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId, deletedAt: null },
    include: {
      assignments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          canvasser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          responses: {
            orderBy: { respondedAt: "desc" },
            include: {
              person: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
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
                },
              },
              competitor: { select: { name: true } },
            },
          },
        },
      },
      entries: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneHome: true,
              phoneMobile: true,
              pollNumber: true,
              supportLevel: true,
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
              canvassResponses: {
                orderBy: { respondedAt: "desc" },
                take: 1,
                select: { outcome: true, supportLevel: true },
              },
            },
          },
        },
      },
    },
  });

  return list;
}

// ── Available canvassers ───────────────────────────────────────────────────

export async function getAvailableCanvassers(
  campaignId: string,
  listId: string
) {
  const alreadyAssigned = await db.canvassAssignment.findMany({
    where: { canvassListId: listId, deletedAt: null },
    select: { canvasserId: true },
  });
  const assignedIds = alreadyAssigned.map((a) => a.canvasserId);

  const memberships = await db.campaignMembership.findMany({
    where: {
      campaignId,
      deletedAt: null,
      role: { not: "finance_lead" as const },
      userId: { notIn: assignedIds },
      user: { isActive: true },
    },
    select: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
  });

  return memberships.map((m) => m.user);
}

// ── Filter preview ─────────────────────────────────────────────────────────

export interface PeopleFilterParams {
  campaignId: string;
  listId: string;
  streetNumber?: string;
  streetName?: string;
  postalCode?: string;
  supportLevel?: SupportLevel | "";
  tagId?: string;
  notYetCanvassed?: boolean;
}

/**
 * Count people matching the given filters, excluding those already in the list.
 * Returns count + a sample of names for the preview.
 */
export async function previewPeopleFilter({
  campaignId,
  listId,
  streetNumber,
  streetName,
  postalCode,
  supportLevel,
  tagId,
  notYetCanvassed,
}: PeopleFilterParams): Promise<{ count: number; sample: string[] }> {
  // People already in this list
  const existing = await db.canvassListEntry.findMany({
    where: { canvassListId: listId, deletedAt: null },
    select: { personId: true },
  });
  const existingIds = existing.map((e) => e.personId);

  // Build the where clause
  const where: Prisma.PersonWhereInput = {
    campaignId,
    deletedAt: null,
    id: existingIds.length > 0 ? { notIn: existingIds } : undefined,
  };

  const addressFilter: Prisma.AddressWhereInput = {};
  if (streetName?.trim()) {
    addressFilter.streetName = { contains: streetName.trim(), mode: "insensitive" };
  }
  if (streetNumber?.trim()) {
    addressFilter.streetNumber = { contains: streetNumber.trim(), mode: "insensitive" };
  }
  if (postalCode?.trim()) {
    addressFilter.postalCode = { contains: postalCode.trim().replace(/\s/g, ""), mode: "insensitive" };
  }
  if (Object.keys(addressFilter).length > 0) {
    where.household = { address: addressFilter };
  }

  if (supportLevel) {
    where.canvassResponses = {
      some: { supportLevel },
    };
  }

  if (tagId) {
    where.tags = { some: { tagId } };
  }

  if (notYetCanvassed) {
    where.canvassResponses = {
      none: {},
    };
  }

  // Hard exclude: out-of-district people cannot appear in walk lists regardless of override.
  where.isOutOfDistrict = false;

  // Hard exclude: do-not-contact people never appear in walk lists.
  where.doNotContact = false;

  // Soft exclude: manual and team records are excluded unless explicitly overridden.
  where.OR = [
    { includeInWalkLists: true },
    {
      AND: [
        { listSource: { notIn: [ListSource.manual, ListSource.team] } },
        { wardStatus: { notIn: [WardStatus.outside, WardStatus.pending_review] } },
      ],
    },
  ];

  const [count, sample] = await Promise.all([
    db.person.count({ where }),
    db.person.findMany({
      where,
      select: { firstName: true, lastName: true },
      take: 5,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  return {
    count,
    sample: sample.map((p) => `${p.firstName} ${p.lastName}`),
  };
}

// ── Outcome summary helper ─────────────────────────────────────────────────

export function summariseOutcomes(
  responses: { outcome: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of responses) {
    counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  }
  return counts;
}

// ── Canvasser: assigned lists ──────────────────────────────────────────────

export async function getAssignedLists(canvasserId: string, campaignId: string) {
  const assignments = await db.canvassAssignment.findMany({
    where: {
      canvasserId,
      deletedAt: null,
      canvassList: { campaignId, deletedAt: null, status: "active" },
    },
    include: {
      canvassList: {
        include: {
          _count: { select: { entries: true } },
        },
      },
      // Fetch only personId so we can count distinct people canvassed.
      // Using _count.responses would count every response (4 visits to the same
      // door = 4), producing percentages over 100%.
      responses: { select: { personId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return assignments.map((a) => {
    const respondedCount = new Set(a.responses.map((r) => r.personId)).size;
    return {
      assignmentId: a.id,
      list: {
        id: a.canvassList.id,
        name: a.canvassList.name,
        description: a.canvassList.description,
      },
      totalEntries: a.canvassList._count.entries,
      totalResponses: respondedCount,
    };
  });
}

// ── Canvassing queue ───────────────────────────────────────────────────────

export async function getCanvassingQueue(
  listId: string,
  canvasserId: string,
  campaignId: string
) {
  const assignment = await db.canvassAssignment.findFirst({
    where: {
      canvassListId: listId,
      canvasserId,
      deletedAt: null,
        canvassList: { campaignId, status: "active" },
    },
    select: { id: true },
  });
  if (!assignment) return null;

  const [listRecord, entries, competitors] = await Promise.all([
    db.canvassList.findFirst({
      where: { id: listId, campaignId, deletedAt: null, status: "active" },
      select: { name: true },
    }),
    db.canvassListEntry.findMany({
      where: { canvassListId: listId, deletedAt: null },
      orderBy: [
        { sortOrder: "asc" },
        { person: { household: { address: { streetName: "asc" } } } },
        { person: { household: { address: { streetNumber: "asc" } } } },
        { person: { lastName: "asc" } },
        { person: { firstName: "asc" } },
      ],
      // Note: unit number is sorted numerically in JS below — Prisma sorts strings alphabetically
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneHome: true,
            phoneMobile: true,
            email: true,
            birthDate: true,
            doNotContact: true,
            household: {
              select: {
                address: {
                  select: {
                    id: true,
                    streetNumber: true,
                    streetName: true,
                    unitNumber: true,
                    city: true,
                    province: true,
                    postalCode: true,
                    lat: true,
                    lng: true,
                  },
                },
                people: {
                  where: { deletedAt: null },
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
            canvassResponses: {
              where: { assignmentId: assignment.id },
              orderBy: { respondedAt: "desc" },
              select: {
                id: true,
                outcome: true,
                supportLevel: true,
                signRequest: true,
                volunteerInterest: true,
                donorInterest: true,
                notes: true,
                needsFollowUp: true,
                respondedAt: true,
              },
            },
          },
        },
      },
    }),
    db.campaignCompetitor.findMany({
      where: { campaignId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  // Sort entries so units within the same building are adjacent and ordered numerically.
  // Prisma's string sort would put "10" before "2"; this corrects that.
  const sortedEntries = [...entries].sort((a, b) => {
    const soA = a.sortOrder ?? Infinity;
    const soB = b.sortOrder ?? Infinity;
    if (soA !== soB) return soA - soB;

    const adA = a.person.household?.address;
    const adB = b.person.household?.address;

    const snComp = (adA?.streetName ?? "").localeCompare(adB?.streetName ?? "");
    if (snComp !== 0) return snComp;

    const numA = parseInt(adA?.streetNumber ?? "0", 10) || 0;
    const numB = parseInt(adB?.streetNumber ?? "0", 10) || 0;
    if (numA !== numB) return numA - numB;

    const uA = adA?.unitNumber ? (parseInt(adA.unitNumber, 10) || 0) : -1;
    const uB = adB?.unitNumber ? (parseInt(adB.unitNumber, 10) || 0) : -1;
    if (uA !== uB) return uA - uB;

    const lc = a.person.lastName.localeCompare(b.person.lastName);
    if (lc !== 0) return lc;
    return a.person.firstName.localeCompare(b.person.firstName);
  });

  return {
    assignmentId: assignment.id,
    listName: listRecord?.name ?? "",
    competitors,
    entries: sortedEntries.map((e) => ({
      entryId: e.id,
      person: {
        id: e.person.id,
        firstName: e.person.firstName,
        lastName: e.person.lastName,
        phoneHome: e.person.phoneHome,
        phoneMobile: e.person.phoneMobile,
        email: e.person.email,
        birthDate: e.person.birthDate,
        doNotContact: e.person.doNotContact,
        address: e.person.household?.address ?? null,
        coResidents: (e.person.household?.people ?? []).filter(
          (p) => p.id !== e.person.id
        ),
      },
      visitCount: e.person.canvassResponses.length,
      lastResponse: e.person.canvassResponses.length > 0
        ? e.person.canvassResponses[0]
        : null,
    })),
  };
}

export type CanvassingQueue = NonNullable<
  Awaited<ReturnType<typeof getCanvassingQueue>>
>;
export type CanvassingEntry = CanvassingQueue["entries"][number];

export type CanvassListSummary = Awaited<
  ReturnType<typeof getCanvassLists>
>[number];
export type CanvassListDetail = NonNullable<
  Awaited<ReturnType<typeof getCanvassListDetail>>
>;
