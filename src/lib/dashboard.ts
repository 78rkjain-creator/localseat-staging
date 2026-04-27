import { db } from "@/lib/db";
import { getFollowUpSummary } from "@/lib/follow-ups";
import type { CanvassOutcome, Prisma } from "@prisma/client";

// ── Helpers ────────────────────────────────────────────────────────────────

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Candidate / Campaign Manager / Co-Chair ────────────────────────────────

export async function getCandidateDashboardData(campaignId: string) {
  const todayStart = startOfToday();

  const allResponses = await db.canvassResponse.findMany({
    where: { assignment: { canvassList: { campaignId } } },
    select: { personId: true, supportLevel: true, outcome: true, respondedAt: true },
    orderBy: { respondedAt: "desc" },
  });
  const latestMap = new Map<string, typeof allResponses[number]>();
  for (const r of allResponses) {
    if (!latestMap.has(r.personId)) {
      latestMap.set(r.personId, r);
    }
  }
  const latestResponses = Array.from(latestMap.values());

  const [
    allPeople,
    doorsTotal,
    doorsToday,
    walkLists,
    followUpSummary,
    donorGroups,
    recentOutreach,
    teamMembers,
    pendingAddressChangeCount,
    canvassersOutTodayRaw,
    competitorGroupsRaw,
    votersWithHistory,
  ] = await Promise.all([
    db.person.findMany({
      where: { campaignId, deletedAt: null },
      select: { id: true },
    }),
    db.canvassResponse.count({
      where: { assignment: { canvassList: { campaignId } } },
    }),
    db.canvassResponse.count({
      where: {
        assignment: { canvassList: { campaignId } },
        respondedAt: { gte: todayStart },
      },
    }),
    db.canvassList.findMany({
      where: { campaignId, deletedAt: null },
      select: {
        id: true,
        name: true,
        _count: { select: { entries: true } },
        assignments: {
          select: {
            responses: { select: { personId: true } },
            canvasser: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    getFollowUpSummary(campaignId),
    db.donor.groupBy({
      by: ["status"],
      where: { campaignId, deletedAt: null },
      _count: { id: true },
    }),
    db.outreachLog.findMany({
      where: { campaignId, deletedAt: null },
      orderBy: { date: "desc" },
      take: 6,
      select: {
        id: true,
        channel: true,
        date: true,
        outcome: true,
        person: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    db.campaignMembership.findMany({
      where: { campaignId, deletedAt: null },
      select: {
        role: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ role: "asc" }, { user: { lastName: "asc" } }],
    }),
    db.addressChangeRequest.count({
      where: { campaignId, status: "pending", deletedAt: null },
    }),
    db.canvassAssignment.findMany({
      where: {
        canvassList: { campaignId },
        deletedAt: null,
        responses: { some: { respondedAt: { gte: todayStart } } },
      },
      select: { canvasserId: true },
      distinct: ["canvasserId"],
    }),
    db.canvassResponse.groupBy({
      by: ["competitorId" as unknown as Prisma.CanvassResponseScalarFieldEnum],
      where: {
        person: { campaignId, deletedAt: null },
        outcome: "other_candidate" as unknown as CanvassOutcome,
        competitorId: { not: null },
      },
      _count: { id: true },
    }),
    db.votingRecord.groupBy({
      by: ["personId"],
      where: { campaignId, deletedAt: null },
    }).then((rows: { personId: string }[]) => rows.length),
  ]);

  const canvassersOutToday = canvassersOutTodayRaw.length;

  // Competitor breakdown — fetch names for the grouped competitor IDs.
  // db.campaignCompetitor cast required until prisma generate runs post-migration.
  const competitorIds = competitorGroupsRaw
    .map((r) => (r as unknown as { competitorId: string | null }).competitorId)
    .filter(Boolean) as string[];
  const competitorNameRecords: { id: string; name: string }[] = competitorIds.length > 0
    ? await (db as unknown as { campaignCompetitor: { findMany: (a: unknown) => Promise<{ id: string; name: string }[]> } })
        .campaignCompetitor.findMany({ where: { id: { in: competitorIds } }, select: { id: true, name: true } })
    : [];
  const competitorNameMap = new Map(competitorNameRecords.map((c) => [c.id, c.name]));
  const competitorBreakdown: { name: string; count: number }[] = competitorGroupsRaw
    .map((r) => {
      const id = (r as unknown as { competitorId: string | null }).competitorId;
      return id ? { name: competitorNameMap.get(id) ?? "Unknown", count: r._count.id } : null;
    })
    .filter((x): x is { name: string; count: number } => x !== null)
    .sort((a, b) => b.count - a.count);

  // Voter ID breakdown
  const latestByPerson = new Map(
    latestResponses.map((r) => [r.personId, { supportLevel: r.supportLevel, outcome: r.outcome }])
  );
  let forUs = 0, againstUs = 0, undecided = 0, notHome = 0, uncontacted = 0;
  for (const { id } of allPeople) {
    if (!latestByPerson.has(id)) { uncontacted++; continue; }
    const { supportLevel: level, outcome } = latestByPerson.get(id)!;
    if ((outcome as string) === "other_candidate") { againstUs++; continue; }
    if (level === "strong_yes" || level === "soft_yes") forUs++;
    else if (level === "strong_no" || level === "soft_no") againstUs++;
    else if (level === "undecided") undecided++;
    else notHome++;
  }
  const walkListProgress = walkLists.map((l) => ({
    id: l.id,
    name: l.name,
    totalEntries: l._count.entries,
    totalResponses: new Set(l.assignments.flatMap((a) => a.responses.map((r) => r.personId))).size,
    canvasserNames: l.assignments.map((a) => `${a.canvasser.firstName} ${a.canvasser.lastName}`),
  }));

  const donorCountByStatus: Record<string, number> = {};
  for (const g of donorGroups) {
    donorCountByStatus[g.status] = g._count.id;
  }

  return {
    total: allPeople.length,
    forUs,
    againstUs,
    undecided,
    notHome,
    uncontacted,
    doorsTotal,
    doorsToday,
    walkListProgress,
    followUpSummary,
    donorCountByStatus,
    recentOutreach,
    teamMembers,
    pendingAddressChangeCount,
    canvassersOutToday,
    competitorBreakdown,
    votersWithHistory,
  };
}

// ── Field Organizer ────────────────────────────────────────────────────────

export async function getFieldOrganizerDashboardData(campaignId: string) {
  const todayStart = startOfToday();

  const [walkLists, doorsToday, unassignedFollowUpCount, canvasserActivityToday, pendingAddressChangeCount] =
    await Promise.all([
      db.canvassList.findMany({
        where: { campaignId, deletedAt: null },
        select: {
          id: true,
          name: true,
          _count: { select: { entries: true } },
          assignments: {
            select: {
              responses: { select: { personId: true } },
              canvasser: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.canvassResponse.count({
        where: {
          assignment: { canvassList: { campaignId } },
          respondedAt: { gte: todayStart },
        },
      }),
      db.task.count({
        where: { campaignId, completed: false, deletedAt: null, assignedTo: null },
      }),
      // Who knocked doors today and how many
      db.canvassResponse.groupBy({
        by: ["assignmentId"],
        where: {
          assignment: { canvassList: { campaignId } },
          respondedAt: { gte: todayStart },
        },
        _count: { id: true },
      }),
      db.addressChangeRequest.count({
        where: { campaignId, status: "pending", deletedAt: null },
      }),
    ]);

  // Enrich canvasser activity with names
  const assignmentIds = canvasserActivityToday.map((r) => r.assignmentId);
  const assignments =
    assignmentIds.length > 0
      ? await db.canvassAssignment.findMany({
          where: { id: { in: assignmentIds }, deletedAt: null },
          select: {
            id: true,
            canvasser: { select: { firstName: true, lastName: true } },
          },
        })
      : [];
  const assignmentMap = new Map(assignments.map((a) => [a.id, a.canvasser]));

  const activityToday = canvasserActivityToday.map((r) => ({
    canvasser: assignmentMap.get(r.assignmentId) ?? { firstName: "Unknown", lastName: "" },
    doorsKnocked: r._count.id,
  }));

  const walkListProgress = walkLists.map((l) => ({
    id: l.id,
    name: l.name,
    totalEntries: l._count.entries,
    totalResponses: new Set(l.assignments.flatMap((a) => a.responses.map((r) => r.personId))).size,
    canvassers: l.assignments.map((a) => a.canvasser),
  }));

  return { walkListProgress, doorsToday, unassignedFollowUpCount, activityToday, pendingAddressChangeCount };
}

// ── Volunteer Coordinator ──────────────────────────────────────────────────

export async function getVolunteerCoordinatorDashboardData(campaignId: string) {
  const [volunteerResponses, volunteerTasks] = await Promise.all([
    // People whose most recent canvass response has volunteerInterest: true
    db.canvassResponse.findMany({
      where: {
        person: { campaignId, deletedAt: null },
        volunteerInterest: true,
      },
      distinct: ["personId"],
      orderBy: { respondedAt: "desc" },
      select: {
        personId: true,
        respondedAt: true,
        person: {
          select: {
            id: true,
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
                  },
                },
              },
            },
          },
        },
      },
    }),
    // Open tasks for volunteer follow-up
    db.task.findMany({
      where: { campaignId, completed: false, deletedAt: null },
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 10,
    }),
  ]);

  return {
    volunteerCount: volunteerResponses.length,
    volunteers: volunteerResponses.map((r) => r.person),
    volunteerTasks,
  };
}

// ── Finance Lead ───────────────────────────────────────────────────────────

export async function getFinanceDashboardData(campaignId: string) {
  const [donorGroups, donorAmounts, thankYouUnsentCount, recentDonors] =
    await Promise.all([
      db.donor.groupBy({
        by: ["status"],
        where: { campaignId, deletedAt: null },
        _count: { id: true },
      }),
      // Sum amounts by status for pledged + received
      db.donor.groupBy({
        by: ["status"],
        where: {
          campaignId,
          deletedAt: null,
          status: { in: ["pledged", "received"] },
          amount: { not: null },
        },
        _sum: { amount: true },
      }),
      db.donor.count({
        where: { campaignId, deletedAt: null, status: "received", thankYouSent: false },
      }),
      db.donor.findMany({
        where: { campaignId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          amount: true,
          donationDate: true,
          createdAt: true,
        },
      }),
    ]);

  const countByStatus: Record<string, number> = {};
  for (const g of donorGroups) countByStatus[g.status] = g._count.id;

  const amountByStatus: Record<string, number> = {};
  for (const g of donorAmounts) {
    amountByStatus[g.status] = g._sum.amount ? Number(g._sum.amount) : 0;
  }

  return {
    countByStatus,
    amountByStatus,
    thankYouUnsentCount,
    recentDonors,
    totalDonors: Object.values(countByStatus).reduce((a, b) => a + b, 0),
  };
}

// ── Canvasser performance stats ────────────────────────────────────────────

export async function getCanvasserStats(campaignId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const assignments = await db.canvassAssignment.findMany({
    where: { canvassList: { campaignId }, deletedAt: null },
    select: {
      id: true,
      canvasserId: true,
      canvasser: { select: { firstName: true, lastName: true } },
      canvassList: { select: { _count: { select: { entries: true } } } },
      responses: {
        select: {
          personId: true,
          signRequest: true,
          volunteerInterest: true,
          respondedAt: true,
        },
      },
    },
  });

  type Agg = {
    canvasserId: string;
    firstName: string;
    lastName: string;
    assignmentCount: number;
    totalEntries: number;
    allPersonIds: Set<string>;
    todayPersonIds: Set<string>;
    signs: number;
    volunteers: number;
    lastActive: Date | null;
  };

  const map = new Map<string, Agg>();

  for (const a of assignments) {
    let agg = map.get(a.canvasserId);
    if (!agg) {
      agg = {
        canvasserId: a.canvasserId,
        firstName: a.canvasser.firstName,
        lastName: a.canvasser.lastName,
        assignmentCount: 0,
        totalEntries: 0,
        allPersonIds: new Set(),
        todayPersonIds: new Set(),
        signs: 0,
        volunteers: 0,
        lastActive: null,
      };
      map.set(a.canvasserId, agg);
    }
    agg.assignmentCount += 1;
    agg.totalEntries += a.canvassList._count.entries;
    for (const r of a.responses) {
      agg.allPersonIds.add(r.personId);
      if (r.respondedAt >= todayStart) agg.todayPersonIds.add(r.personId);
      if (r.signRequest) agg.signs += 1;
      if (r.volunteerInterest) agg.volunteers += 1;
      if (!agg.lastActive || r.respondedAt > agg.lastActive) agg.lastActive = r.respondedAt;
    }
  }

  return Array.from(map.values())
    .filter((c) => c.allPersonIds.size > 0)
    .map((c) => ({
      canvasserId: c.canvasserId,
      firstName: c.firstName,
      lastName: c.lastName,
      totalDoors: c.allPersonIds.size,
      doorsToday: c.todayPersonIds.size,
      signs: c.signs,
      volunteers: c.volunteers,
      avgDoorsPerAssignment:
        c.assignmentCount > 0 ? Math.round(c.allPersonIds.size / c.assignmentCount) : 0,
      completionPct:
        c.totalEntries > 0
          ? Math.min(100, Math.round((c.allPersonIds.size / c.totalEntries) * 100))
          : 0,
      lastActive: c.lastActive?.toISOString() ?? null,
    }))
    .sort((a, b) => b.totalDoors - a.totalDoors);
}

export type CanvasserStat = Awaited<ReturnType<typeof getCanvasserStats>>[number];

// ── Recent canvass activity ────────────────────────────────────────────────

export async function getRecentCanvassActivity(campaignId: string) {
  const responses = await db.canvassResponse.findMany({
    where: { assignment: { canvassList: { campaignId } } },
    orderBy: { respondedAt: "desc" },
    take: 20,
    select: {
      id: true,
      outcome: true,
      supportLevel: true,
      signRequest: true,
      volunteerInterest: true,
      donorInterest: true,
      respondedAt: true,
      assignment: {
        select: {
          canvasser: { select: { firstName: true, lastName: true } },
        },
      },
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
                },
              },
            },
          },
        },
      },
    },
  });

  return responses.map((r) => {
    const addr = r.person.household?.address;
    return {
      id: r.id,
      canvasserName: `${r.assignment.canvasser.firstName} ${r.assignment.canvasser.lastName}`,
      canvasserInitials: `${r.assignment.canvasser.firstName[0]}${r.assignment.canvasser.lastName[0]}`,
      personName: `${r.person.firstName} ${r.person.lastName}`,
      personId: r.person.id,
      address: addr
        ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
        : null,
      outcome: r.outcome as string,
      supportLevel: r.supportLevel as string | null,
      signRequest: r.signRequest,
      volunteerInterest: r.volunteerInterest,
      donorInterest: r.donorInterest,
      respondedAt: r.respondedAt.toISOString(),
    };
  });
}

export type CanvassActivityEntry = Awaited<ReturnType<typeof getRecentCanvassActivity>>[number];

// ── Needs-you queue ────────────────────────────────────────────────────────

type QueuePriority = "overdue" | "today" | "this-week" | "neutral";

interface NeedsYouItem {
  id: string;
  label: string;
  count: number;
  priority: QueuePriority;
  href: string;
}

const PRIORITY_ORDER: Record<QueuePriority, number> = {
  overdue: 0,
  today: 1,
  "this-week": 2,
  neutral: 3,
};

export async function getNeedsYouQueue(campaignId: string): Promise<NeedsYouItem[]> {
  const [
    overdueFollowUpCount,
    pledgedDonorCount,
    walkListsRaw,
    pendingAddressChangeCount,
  ] = await Promise.all([
    db.task.count({
      where: { campaignId, completed: false, deletedAt: null, dueDate: { lt: new Date() } },
    }),
    db.donor.count({
      where: { campaignId, status: "pledged", deletedAt: null },
    }),
    db.canvassList.findMany({
      where: { campaignId, deletedAt: null },
      select: {
        _count: { select: { entries: true } },
        assignments: { select: { responses: { select: { personId: true } } } },
      },
    }),
    db.addressChangeRequest.count({
      where: { campaignId, status: "pending", deletedAt: null },
    }),
  ]);

  const walkListsInProgress = walkListsRaw.filter((l) => {
    if (l._count.entries === 0) return false;
    const responded = new Set(l.assignments.flatMap((a) => a.responses.map((r) => r.personId))).size;
    const pct = responded / l._count.entries;
    return pct >= 0.5 && pct < 1.0;
  }).length;

  const items: NeedsYouItem[] = [];

  if (overdueFollowUpCount > 0)
    items.push({ id: "overdue-followups", label: "follow-ups overdue", count: overdueFollowUpCount, priority: "overdue", href: "/follow-ups" });
  if (pledgedDonorCount > 0)
    items.push({ id: "pledged-donors", label: "pledged donors to call", count: pledgedDonorCount, priority: "today", href: "/donors" });
  if (walkListsInProgress > 0)
    items.push({ id: "walklists-in-progress", label: "walk lists need attention", count: walkListsInProgress, priority: "today", href: "/canvassing" });
  if (pendingAddressChangeCount > 0)
    items.push({ id: "address-changes", label: "address changes to review", count: pendingAddressChangeCount, priority: "today", href: "/address-changes" });

  return items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
