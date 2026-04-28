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

// ── Dashboard hero data ────────────────────────────────────────────────────

function buildDaySeries(now: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
}

function dayKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function getDashboardHeroData(campaignId: string) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    campaign,
    totalPeople,
    allResponses,
    responseCountsByPerson,
    signsOut,
    signsInstalledLast7,
    totalRaised,
    donorsLast7,
    competitorCount,
  ] = await Promise.all([
    db.campaign.findUnique({
      where: { id: campaignId },
      select: { fundraisingGoal: true, electionDate: true, name: true },
    }),
    db.person.count({ where: { campaignId, deletedAt: null } }),
    db.canvassResponse.findMany({
      where: { assignment: { canvassList: { campaignId } } },
      select: { personId: true, supportLevel: true, respondedAt: true },
      orderBy: { respondedAt: "desc" },
    }),
    db.canvassResponse.groupBy({
      by: ["personId"],
      where: { assignment: { canvassList: { campaignId } } },
      _count: { id: true },
    }),
    db.sign.count({ where: { campaignId, status: "installed", deletedAt: null } }),
    db.sign.findMany({
      where: {
        campaignId,
        status: "installed",
        deletedAt: null,
        installedAt: { gte: sevenDaysAgo },
      },
      select: { installedAt: true },
    }),
    db.donor.count({ where: { campaignId, status: "received", deletedAt: null } }),
    db.donor.findMany({
      where: { campaignId, status: "received", deletedAt: null, updatedAt: { gte: sevenDaysAgo } },
      select: { updatedAt: true },
    }),
    db.campaignCompetitor.count({ where: { campaignId, deletedAt: null } }),
  ]);

  // Latest response per person → support rate
  const latestMap = new Map<string, { supportLevel: string | null }>();
  for (const r of allResponses) {
    if (!latestMap.has(r.personId)) {
      latestMap.set(r.personId, { supportLevel: r.supportLevel as string | null });
    }
  }
  const canvassedCount = latestMap.size;
  let forUsCount = 0;
  for (const { supportLevel } of latestMap.values()) {
    if (supportLevel === "strong_yes" || supportLevel === "soft_yes") forUsCount++;
  }
  const supportRate = canvassedCount > 0 ? Math.round((forUsCount / canvassedCount) * 100) : 0;

  // Contacted frequency buckets
  let contactedOnce = 0, contactedTwice = 0, contactedThreePlus = 0;
  for (const g of responseCountsByPerson) {
    const c = g._count.id;
    if (c === 1) contactedOnce++;
    else if (c === 2) contactedTwice++;
    else contactedThreePlus++;
  }

  // Doors total and today (distinct persons)
  const allPersonIds = new Set(allResponses.map((r) => r.personId));
  const todayPersonIds = new Set(
    allResponses.filter((r) => r.respondedAt >= todayStart).map((r) => r.personId)
  );
  const doorsTotal = allPersonIds.size;
  const doorsToday = todayPersonIds.size;

  // 7-day series
  const days = buildDaySeries(now);

  // Doors per day (distinct persons)
  const doorsByDay = new Map<string, Set<string>>(days.map((d) => [d, new Set()]));
  for (const r of allResponses) {
    const dk = dayKey(r.respondedAt);
    doorsByDay.get(dk)?.add(r.personId);
  }
  const doorsSeries = days.map((d) => ({ date: d, count: doorsByDay.get(d)?.size ?? 0 }));
  const doorsAvg7Day = Math.round(doorsSeries.reduce((s, p) => s + p.count, 0) / 7);

  // Support rate per day (yes canvasses / total canvasses that day)
  const yesByDay = new Map<string, number>(days.map((d) => [d, 0]));
  const totalByDay = new Map<string, number>(days.map((d) => [d, 0]));
  for (const r of allResponses) {
    const dk = dayKey(r.respondedAt);
    if (!totalByDay.has(dk)) continue;
    totalByDay.set(dk, (totalByDay.get(dk) ?? 0) + 1);
    const sl = r.supportLevel as string | null;
    if (sl === "strong_yes" || sl === "soft_yes") {
      yesByDay.set(dk, (yesByDay.get(dk) ?? 0) + 1);
    }
  }
  const supportRateSeries = days.map((d) => {
    const total = totalByDay.get(d) ?? 0;
    const yes = yesByDay.get(d) ?? 0;
    return { date: d, count: total > 0 ? Math.round((yes / total) * 100) : 0 };
  });

  // Signs installed per day
  const signsByDay = new Map<string, number>(days.map((d) => [d, 0]));
  for (const s of signsInstalledLast7) {
    if (s.installedAt) {
      const dk = dayKey(s.installedAt);
      if (signsByDay.has(dk)) signsByDay.set(dk, (signsByDay.get(dk) ?? 0) + 1);
    }
  }
  const signsSeries = days.map((d) => ({ date: d, count: signsByDay.get(d) ?? 0 }));

  // Donors received per day
  const donorsByDay = new Map<string, number>(days.map((d) => [d, 0]));
  for (const don of donorsLast7) {
    const dk = dayKey(don.updatedAt);
    if (donorsByDay.has(dk)) donorsByDay.set(dk, (donorsByDay.get(dk) ?? 0) + 1);
  }
  const donorsSeries = days.map((d) => ({ date: d, count: donorsByDay.get(d) ?? 0 }));

  return {
    supportRate,
    totalPeople,
    contactedOnce,
    contactedTwice,
    contactedThreePlus,
    doorsToday,
    doorsTotal,
    signsOut,
    totalRaised,
    campaignName: campaign?.name ?? "",
    fundraisingGoal: campaign?.fundraisingGoal ?? null,
    electionDate: campaign?.electionDate ?? null,
    competitorCount,
    doorsSeries,
    supportRateSeries,
    signsSeries,
    donorsSeries,
    doorsAvg7Day,
  };
}

export type DashboardHeroData = Awaited<ReturnType<typeof getDashboardHeroData>>;

// ── Field organizer dashboard data ────────────────────────────────────────

export async function getFieldOrganizerDashData(campaignId: string, userId: string) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const [
    walkLists,
    pendingApprovalCount,
    openFollowUpCount,
    weekResponses,
    prevWeekResponses,
    assignments,
  ] = await Promise.all([
    db.canvassList.findMany({
      where: { campaignId, deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        _count: { select: { entries: true } },
        assignments: {
          where: { deletedAt: null },
          select: {
            canvasserId: true,
            responses: { select: { personId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.canvassList.count({
      where: { campaignId, deletedAt: null, status: "pending_approval" },
    }),
    db.task.count({
      where: { campaignId, completed: false, deletedAt: null, assignedTo: userId },
    }),
    db.canvassResponse.findMany({
      where: {
        assignment: { canvassList: { campaignId } },
        respondedAt: { gte: weekStart },
      },
      select: { outcome: true },
    }),
    db.canvassResponse.findMany({
      where: {
        assignment: { canvassList: { campaignId } },
        respondedAt: { gte: prevWeekStart, lt: weekStart },
      },
      select: { outcome: true },
    }),
    db.canvassAssignment.findMany({
      where: { canvassList: { campaignId }, deletedAt: null },
      select: {
        canvasserId: true,
        canvasser: { select: { id: true, firstName: true, lastName: true } },
        responses: { select: { personId: true, respondedAt: true } },
      },
    }),
  ]);

  // Walk list progress
  const lists = walkLists.map((l) => {
    const respondedPersonIds = new Set(
      l.assignments.flatMap((a) => a.responses.map((r) => r.personId))
    );
    const totalEntries = l._count.entries;
    const responded = respondedPersonIds.size;
    return {
      id: l.id,
      name: l.name,
      status: l.status as string,
      totalEntries,
      responded,
      completionPct:
        totalEntries > 0 ? Math.min(100, Math.round((responded / totalEntries) * 100)) : 0,
    };
  });

  // Canvasser stats: doors today + last active
  type CanvasserAgg = {
    id: string;
    firstName: string;
    lastName: string;
    doorsToday: Set<string>;
    lastActive: Date | null;
  };
  const canvasserMap = new Map<string, CanvasserAgg>();
  for (const a of assignments) {
    if (!canvasserMap.has(a.canvasserId)) {
      canvasserMap.set(a.canvasserId, {
        id: a.canvasserId,
        firstName: a.canvasser.firstName,
        lastName: a.canvasser.lastName,
        doorsToday: new Set(),
        lastActive: null,
      });
    }
    const agg = canvasserMap.get(a.canvasserId)!;
    for (const r of a.responses) {
      if (r.respondedAt >= todayStart) agg.doorsToday.add(r.personId);
      if (!agg.lastActive || r.respondedAt > agg.lastActive) agg.lastActive = r.respondedAt;
    }
  }
  const canvassers = Array.from(canvasserMap.values())
    .map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      doorsToday: c.doorsToday.size,
      lastActive: c.lastActive?.toISOString() ?? null,
    }))
    .sort((a, b) => b.doorsToday - a.doorsToday);

  // Not-home rate this week vs previous week
  const notHomeRate = (responses: { outcome: string }[]) => {
    if (responses.length === 0) return 0;
    return Math.round(
      (responses.filter((r) => r.outcome === "not_home").length / responses.length) * 100
    );
  };
  const notHomeRateThisWeek = notHomeRate(weekResponses);
  const notHomeRatePrevWeek = notHomeRate(prevWeekResponses);

  return {
    lists,
    canvassers,
    pendingApprovalCount,
    openFollowUpCount,
    notHomeRateThisWeek,
    notHomeRatePrevWeek,
    notHomeRateDelta: notHomeRateThisWeek - notHomeRatePrevWeek,
  };
}

export type FieldOrganizerDashData = Awaited<ReturnType<typeof getFieldOrganizerDashData>>;

// ── Finance lead dashboard data ────────────────────────────────────────────

export async function getFinanceLeadDashData(campaignId: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [campaign, donorGroups, topDonorsNeedingAction, donorsLast7] = await Promise.all([
    db.campaign.findUnique({
      where: { id: campaignId },
      select: { fundraisingGoal: true },
    }),
    db.donor.groupBy({
      by: ["status"],
      where: { campaignId, deletedAt: null },
      _count: { id: true },
    }),
    db.donor.findMany({
      where: {
        campaignId,
        deletedAt: null,
        status: { in: ["interested", "pledged", "received"] },
      },
      orderBy: { updatedAt: "asc" },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        amount: true,
        updatedAt: true,
      },
    }),
    db.donor.findMany({
      where: { campaignId, status: "received", deletedAt: null, updatedAt: { gte: sevenDaysAgo } },
      select: { updatedAt: true },
    }),
  ]);

  const countByStatus: Record<string, number> = {};
  for (const g of donorGroups) countByStatus[g.status] = g._count.id;

  const interested = countByStatus["interested"] ?? 0;
  const pledged = countByStatus["pledged"] ?? 0;
  const received = countByStatus["received"] ?? 0;

  // 7-day donors received series
  const days = buildDaySeries(now);
  const donorsByDay = new Map<string, number>(days.map((d) => [d, 0]));
  for (const don of donorsLast7) {
    const dk = dayKey(don.updatedAt);
    if (donorsByDay.has(dk)) donorsByDay.set(dk, (donorsByDay.get(dk) ?? 0) + 1);
  }
  const donorsSeries = days.map((d) => ({ date: d, count: donorsByDay.get(d) ?? 0 }));

  return {
    interested,
    pledged,
    received,
    totalRaised: received,
    fundraisingGoal: campaign?.fundraisingGoal ?? null,
    pipelineCount: interested + pledged,
    topDonorsNeedingAction: topDonorsNeedingAction.map((d) => ({
      id: d.id,
      name: `${d.firstName} ${d.lastName}`,
      status: d.status as string,
      amount: d.amount ? Number(d.amount) : null,
      daysSinceUpdate: Math.floor((now.getTime() - d.updatedAt.getTime()) / 86400000),
    })),
    donorsSeries,
  };
}

export type FinanceLeadDashData = Awaited<ReturnType<typeof getFinanceLeadDashData>>;

// ── Volunteer coordinator dashboard data ──────────────────────────────────

export async function getVolunteerCoordDashData(campaignId: string) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [
    volunteerCount,
    newSignupsThisWeek,
    upcomingShifts,
    recentShiftAttendees,
    volunteerFollowUps,
    signupsLast7,
  ] = await Promise.all([
    db.volunteerRecord.count({ where: { campaignId, deletedAt: null } }),
    db.canvassResponse.count({
      where: {
        person: { campaignId, deletedAt: null },
        volunteerInterest: true,
        respondedAt: { gte: sevenDaysAgo },
      },
    }),
    db.volunteerShift.findMany({
      where: { campaignId, deletedAt: null, date: { gte: todayStart, lt: weekEnd } },
      select: {
        id: true,
        name: true,
        date: true,
        startTime: true,
        endTime: true,
        location: true,
        maxVolunteers: true,
        attendees: { where: { deletedAt: null }, select: { status: true } },
      },
      orderBy: { date: "asc" },
    }),
    db.volunteerShiftAttendee.findMany({
      where: {
        shift: { campaignId, deletedAt: null, date: { lt: todayStart } },
        deletedAt: null,
      },
      select: { status: true },
      take: 500,
    }),
    db.task.count({
      where: { campaignId, completed: false, deletedAt: null, type: "volunteer_follow_up" },
    }),
    db.canvassResponse.findMany({
      where: {
        person: { campaignId, deletedAt: null },
        volunteerInterest: true,
        respondedAt: { gte: sevenDaysAgo },
      },
      select: { respondedAt: true },
    }),
  ]);

  // Attendance rate across recent past shifts
  const totalAttendees = recentShiftAttendees.length;
  const attended = recentShiftAttendees.filter((a) => a.status === "attended").length;
  const attendanceRate = totalAttendees > 0 ? Math.round((attended / totalAttendees) * 100) : 0;

  // Upcoming shifts
  const shifts = upcomingShifts.map((s) => ({
    id: s.id,
    name: s.name,
    date: s.date.toISOString().split("T")[0],
    startTime: s.startTime,
    endTime: s.endTime,
    location: s.location,
    signupCount: s.attendees.length,
    maxVolunteers: s.maxVolunteers,
  }));

  // 7-day volunteer sign-up series
  const days = buildDaySeries(now);
  const signupsByDay = new Map<string, number>(days.map((d) => [d, 0]));
  for (const r of signupsLast7) {
    const dk = dayKey(r.respondedAt);
    if (signupsByDay.has(dk)) signupsByDay.set(dk, (signupsByDay.get(dk) ?? 0) + 1);
  }
  const signupsSeries = days.map((d) => ({ date: d, count: signupsByDay.get(d) ?? 0 }));

  return {
    volunteerCount,
    newSignupsThisWeek,
    shifts,
    attendanceRate,
    volunteerFollowUps,
    signupsSeries,
  };
}

export type VolunteerCoordDashData = Awaited<ReturnType<typeof getVolunteerCoordDashData>>;

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
