import { db } from "@/lib/db";
import type { SupportLevel, PollStrikeType } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GotvStats {
  voteTarget: number | null;
  totalSupporters: number;
  alreadyVoted: number;
  remaining: number;
  needsRide: number;
  gapToWin: number | null;
  hourlyStrikes: { hour: number; count: number }[];
  advanceVoted: number;
  electionDayVoted: number;
  mailInVoted: number;
}

export interface ChaseListPerson {
  id: string;
  firstName: string;
  lastName: string;
  supportLevel: SupportLevel | null;
  needsRide: boolean;
  votingPlanTime: string | null;
  phoneHome: string | null;
  phoneMobile: string | null;
  address: {
    streetNumber: string | null;
    streetName: string | null;
    unitNumber: string | null;
    city: string | null;
  } | null;
}

// ── Support levels that count as "our supporters" ─────────────────────────────

const SUPPORTER_LEVELS: SupportLevel[] = ["strong_yes", "soft_yes"];

// ── GOTV stats for election day dashboard ─────────────────────────────────────

export async function getGotvStats(campaignId: string): Promise<GotvStats> {
  const [campaign, supporters, strikes] = await Promise.all([
    db.campaign.findUnique({
      where: { id: campaignId },
      select: { voteTarget: true },
    }),
    db.person.count({
      where: {
        campaignId,
        deletedAt: null,
        supportLevel: { in: SUPPORTER_LEVELS },
      },
    }),
    db.pollStrike.findMany({
      where: { campaignId },
      select: { strikeType: true, struckAt: true },
    }),
  ]);

  const alreadyVoted = strikes.length;
  const remaining = Math.max(0, supporters - alreadyVoted);
  const voteTarget = campaign?.voteTarget ?? null;
  const gapToWin = voteTarget !== null ? Math.max(0, voteTarget - alreadyVoted) : null;

  // Count by type
  let advanceVoted = 0;
  let electionDayVoted = 0;
  let mailInVoted = 0;
  for (const s of strikes) {
    if (s.strikeType === "advance_poll") advanceVoted++;
    else if (s.strikeType === "election_day") electionDayVoted++;
    else if (s.strikeType === "mail_in") mailInVoted++;
  }

  // Hourly breakdown (for today's strikes only)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const hourCounts = new Map<number, number>();
  for (let h = 6; h <= 22; h++) hourCounts.set(h, 0);
  for (const s of strikes) {
    if (s.struckAt >= todayStart) {
      const hour = s.struckAt.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }
  }
  const hourlyStrikes = Array.from(hourCounts.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour);

  // Ride requests count (among supporters who haven't voted)
  const needsRide = await db.person.count({
    where: {
      campaignId,
      deletedAt: null,
      needsRide: true,
      supportLevel: { in: SUPPORTER_LEVELS },
      pollStrikes: { none: {} },
    },
  });

  return {
    voteTarget,
    totalSupporters: supporters,
    alreadyVoted,
    remaining,
    needsRide,
    gapToWin,
    hourlyStrikes,
    advanceVoted,
    electionDayVoted,
    mailInVoted,
  };
}

// ── Chase list: supporters who haven't voted yet ──────────────────────────────

export async function getChaseList(
  campaignId: string,
  options?: {
    needsRideOnly?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ people: ChaseListPerson[]; total: number }> {
  const where = {
    campaignId,
    deletedAt: null,
    doNotContact: false,
    supportLevel: { in: SUPPORTER_LEVELS },
    pollStrikes: { none: {} },
    ...(options?.needsRideOnly ? { needsRide: true } : {}),
  };

  const [people, total] = await Promise.all([
    db.person.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        supportLevel: true,
        needsRide: true,
        votingPlanTime: true,
        phoneHome: true,
        phoneMobile: true,
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
      orderBy: [
        { supportLevel: "asc" }, // strong_yes first
        { lastName: "asc" },
      ],
      take: options?.limit ?? 200,
      skip: options?.offset ?? 0,
    }),
    db.person.count({ where }),
  ]);

  return {
    people: people.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      supportLevel: p.supportLevel,
      needsRide: p.needsRide,
      votingPlanTime: p.votingPlanTime,
      phoneHome: p.phoneHome,
      phoneMobile: p.phoneMobile,
      address: p.household?.address
        ? {
            streetNumber: p.household.address.streetNumber,
            streetName: p.household.address.streetName,
            unitNumber: p.household.address.unitNumber,
            city: p.household.address.city,
          }
        : null,
    })),
    total,
  };
}

// ── Ride requests list ────────────────────────────────────────────────────────

export async function getRideRequests(campaignId: string) {
  return db.person.findMany({
    where: {
      campaignId,
      deletedAt: null,
      needsRide: true,
      supportLevel: { in: SUPPORTER_LEVELS },
      pollStrikes: { none: {} },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneMobile: true,
      phoneHome: true,
      votingPlanTime: true,
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
    orderBy: { lastName: "asc" },
  });
}

// ── Record a poll strike ──────────────────────────────────────────────────────

export async function recordPollStrike(
  campaignId: string,
  personId: string,
  struckById: string,
  strikeType: PollStrikeType = "election_day",
  notes?: string
) {
  return db.pollStrike.upsert({
    where: {
      campaignId_personId: { campaignId, personId },
    },
    create: {
      campaignId,
      personId,
      struckById,
      strikeType,
      notes: notes ?? null,
    },
    update: {
      strikeType,
      struckById,
      struckAt: new Date(),
      notes: notes ?? null,
    },
  });
}

// ── Undo a poll strike ────────────────────────────────────────────────────────

export async function undoPollStrike(campaignId: string, personId: string) {
  return db.pollStrike.deleteMany({
    where: { campaignId, personId },
  });
}

// ── Check GOTV mode status ────────────────────────────────────────────────────

export async function isGotvMode(campaignId: string): Promise<boolean> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { gotvModeEnabled: true },
  });
  return campaign?.gotvModeEnabled ?? false;
}

// ── Search people for poll striking (fast name lookup) ────────────────────────

export async function searchForPollStrike(
  campaignId: string,
  query: string,
  limit = 20
) {
  if (!query.trim()) return [];

  const terms = query.trim().split(/\s+/);
  const firstTerm = terms[0];
  const secondTerm = terms[1] ?? null;

  // If two terms, treat as firstName + lastName
  const where = secondTerm
    ? {
        campaignId,
        deletedAt: null,
        firstName: { startsWith: firstTerm, mode: "insensitive" as const },
        lastName: { startsWith: secondTerm, mode: "insensitive" as const },
      }
    : {
        campaignId,
        deletedAt: null,
        OR: [
          { firstName: { startsWith: firstTerm, mode: "insensitive" as const } },
          { lastName: { startsWith: firstTerm, mode: "insensitive" as const } },
        ],
      };

  return db.person.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      supportLevel: true,
      household: {
        select: {
          address: {
            select: {
              streetNumber: true,
              streetName: true,
              unitNumber: true,
            },
          },
        },
      },
      pollStrikes: {
        select: { id: true, strikeType: true, struckAt: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: limit,
  });
}
