import { db } from "@/lib/db";
import type { SupportLevel } from "@/types";

// ── Walk list index ────────────────────────────────────────────────────────

export async function getCanvassLists(campaignId: string) {
  const lists = await db.canvassList.findMany({
    where: { campaignId, deletedAt: null },
    include: {
      assignments: {
        include: {
          canvasser: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { responses: true } },
        },
      },
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return lists.map((list) => {
    const totalResponses = list.assignments.reduce(
      (sum, a) => sum + a._count.responses,
      0
    );
    return { ...list, totalResponses, totalEntries: list._count.entries };
  });
}

// ── Walk list detail ───────────────────────────────────────────────────────

export async function getCanvassListDetail(listId: string, campaignId: string) {
  const list = await db.canvassList.findFirst({
    where: { id: listId, campaignId, deletedAt: null },
    include: {
      assignments: {
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
            },
          },
        },
      },
      entries: {
        orderBy: { createdAt: "asc" },
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
    where: { canvassListId: listId },
    select: { canvasserId: true },
  });
  const assignedIds = alreadyAssigned.map((a) => a.canvasserId);

  const memberships = await db.campaignMembership.findMany({
    where: {
      campaignId,
      role: "canvasser",
      userId: { notIn: assignedIds },
      user: { isActive: true },
    },
    select: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });

  return memberships.map((m) => m.user);
}

// ── Filter preview ─────────────────────────────────────────────────────────

export interface PeopleFilterParams {
  campaignId: string;
  listId: string;
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
  streetName,
  postalCode,
  supportLevel,
  tagId,
  notYetCanvassed,
}: PeopleFilterParams): Promise<{ count: number; sample: string[] }> {
  // People already in this list
  const existing = await db.canvassListEntry.findMany({
    where: { canvassListId: listId },
    select: { personId: true },
  });
  const existingIds = existing.map((e) => e.personId);

  // Build the where clause
  const where: Parameters<typeof db.person.findMany>[0]["where"] = {
    campaignId,
    deletedAt: null,
    id: existingIds.length > 0 ? { notIn: existingIds } : undefined,
  };

  if (streetName?.trim()) {
    where.household = {
      address: {
        streetName: { contains: streetName.trim(), mode: "insensitive" },
      },
    };
  }

  if (postalCode?.trim()) {
    where.household = {
      ...(where.household as object ?? {}),
      address: {
        ...((where.household as { address?: object })?.address ?? {}),
        postalCode: { contains: postalCode.trim().replace(/\s/g, ""), mode: "insensitive" },
      },
    };
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
      canvassList: { campaignId, deletedAt: null },
    },
    include: {
      canvassList: {
        include: {
          _count: { select: { entries: true } },
        },
      },
      _count: { select: { responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return assignments.map((a) => ({
    assignmentId: a.id,
    list: {
      id: a.canvassList.id,
      name: a.canvassList.name,
      description: a.canvassList.description,
    },
    totalEntries: a.canvassList._count.entries,
    totalResponses: a._count.responses,
  }));
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
      canvassList: { campaignId },
    },
    select: { id: true },
  });
  if (!assignment) return null;

  const [listRecord, entries] = await Promise.all([
    db.canvassList.findFirst({
      where: { id: listId, campaignId },
      select: { name: true },
    }),
    db.canvassListEntry.findMany({
      where: { canvassListId: listId },
      orderBy: [
        { person: { household: { address: { streetName: "asc" } } } },
        { person: { household: { address: { streetNumber: "asc" } } } },
        { person: { lastName: "asc" } },
        { person: { firstName: "asc" } },
      ],
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
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
                people: {
                  where: { deletedAt: null },
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
            canvassResponses: {
              where: { assignmentId: assignment.id },
              orderBy: { respondedAt: "desc" },
              take: 1,
              select: {
                id: true,
                outcome: true,
                supportLevel: true,
                signRequest: true,
                volunteerInterest: true,
                donorInterest: true,
                notes: true,
                needsFollowUp: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    assignmentId: assignment.id,
    listName: listRecord?.name ?? "",
    entries: entries.map((e) => ({
      entryId: e.id,
      person: {
        id: e.person.id,
        firstName: e.person.firstName,
        lastName: e.person.lastName,
        phone: e.person.phone,
        address: e.person.household?.address ?? null,
        coResidents: (e.person.household?.people ?? []).filter(
          (p) => p.id !== e.person.id
        ),
      },
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
