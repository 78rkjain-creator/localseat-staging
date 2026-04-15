import { db } from "@/lib/db";
import type { OutreachChannel } from "@/types";

// ── Filters ────────────────────────────────────────────────────────────────

export interface OutreachFilters {
  campaignId: string;
  channel?: OutreachChannel | "";
  staffId?: string;
  dateFrom?: string; // ISO date string
  dateTo?: string;
  page?: number;
}

const PAGE_SIZE = 30;

// ── Full campaign log (managers / organizers / candidate) ──────────────────

export async function getOutreachLog({
  campaignId,
  channel,
  staffId,
  dateFrom,
  dateTo,
  page = 1,
}: OutreachFilters) {
  const skip = (page - 1) * PAGE_SIZE;

  const where = buildWhere({ campaignId, channel, staffId, dateFrom, dateTo });

  const [logs, total] = await Promise.all([
    db.outreachLog.findMany({
      where,
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
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { date: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.outreachLog.count({ where }),
  ]);

  return { logs, total, totalPages: Math.ceil(total / PAGE_SIZE) };
}

// ── Single-user log (canvassers) ───────────────────────────────────────────

export async function getMyOutreachLog({
  campaignId,
  userId,
  channel,
  dateFrom,
  dateTo,
  page = 1,
}: OutreachFilters & { userId: string }) {
  const skip = (page - 1) * PAGE_SIZE;

  const where = buildWhere({ campaignId, channel, staffId: userId, dateFrom, dateTo });

  const [logs, total] = await Promise.all([
    db.outreachLog.findMany({
      where,
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
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { date: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.outreachLog.count({ where }),
  ]);

  return { logs, total, totalPages: Math.ceil(total / PAGE_SIZE) };
}

// ── Staff members for filter dropdown ─────────────────────────────────────

export async function getOutreachStaffMembers(campaignId: string) {
  const memberships = await db.campaignMembership.findMany({
    where: { campaignId, user: { isActive: true } },
    select: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });
  return memberships.map((m) => m.user);
}

// ── All logs for history export (no pagination) ────────────────────────────

export async function getAllOutreachLogsForExport(campaignId: string) {
  return db.outreachLog.findMany({
    where: { campaignId, deletedAt: null },
    include: {
      person: {
        select: {
          firstName: true,
          lastName: true,
          phoneHome: true,
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
        },
      },
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { date: "desc" },
  });
}

// ── People for export template ─────────────────────────────────────────────

export async function getPeopleForExportTemplate(
  campaignId: string,
  supportLevel?: string
) {
  // When a support level filter is requested, restrict to people whose most
  // recent canvass response has that support level.
  let personIdFilter: string[] | undefined;

  if (supportLevel) {
    // Get the latest response per person using distinct + orderBy
    const latestResponses = await db.canvassResponse.findMany({
      where: { person: { campaignId, deletedAt: null } },
      orderBy: { respondedAt: "desc" },
      distinct: ["personId"],
      select: { personId: true, supportLevel: true },
    });

    personIdFilter = latestResponses
      .filter((r) => r.supportLevel === supportLevel)
      .map((r) => r.personId);

    // If no one matches, return empty — avoid a full table scan
    if (personIdFilter.length === 0) return [];
  }

  return db.person.findMany({
    where: {
      campaignId,
      deletedAt: null,
      ...(personIdFilter ? { id: { in: personIdFilter } } : {}),
    },
    select: {
      firstName: true,
      lastName: true,
      phoneHome: true,
      email: true,
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
    },
    orderBy: [
      { household: { address: { streetName: "asc" } } },
      { household: { address: { streetNumber: "asc" } } },
      { lastName: "asc" },
      { firstName: "asc" },
    ],
  });
}

// ── Where clause builder ───────────────────────────────────────────────────

function buildWhere({
  campaignId,
  channel,
  staffId,
  dateFrom,
  dateTo,
}: Omit<OutreachFilters, "page"> & { staffId?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { campaignId, deletedAt: null };

  if (channel) where.channel = channel;
  if (staffId) where.userId = staffId;

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  return where;
}
