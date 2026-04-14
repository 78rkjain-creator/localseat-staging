import { db } from "@/lib/db";
import { getFollowUpSummary } from "@/lib/follow-ups";

// ── Helpers ────────────────────────────────────────────────────────────────

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Candidate / Campaign Manager / Co-Chair ────────────────────────────────

export async function getCandidateDashboardData(campaignId: string) {
  const todayStart = startOfToday();

  const [
    allPeople,
    latestResponses,
    doorsTotal,
    doorsToday,
    walkLists,
    followUpSummary,
    donorGroups,
    recentOutreach,
    teamMembers,
  ] = await Promise.all([
    db.person.findMany({
      where: { campaignId, deletedAt: null },
      select: { id: true },
    }),
    db.canvassResponse.findMany({
      where: { person: { campaignId, deletedAt: null } },
      orderBy: { respondedAt: "desc" },
      distinct: ["personId"],
      select: { personId: true, supportLevel: true },
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
            _count: { select: { responses: true } },
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
      where: { campaignId },
      select: {
        role: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ role: "asc" }, { user: { lastName: "asc" } }],
    }),
  ]);

  // Voter ID breakdown
  const latestByPerson = new Map(latestResponses.map((r) => [r.personId, r.supportLevel]));
  let forUs = 0, againstUs = 0, undecided = 0, notHome = 0, uncontacted = 0;
  for (const { id } of allPeople) {
    if (!latestByPerson.has(id)) { uncontacted++; continue; }
    const level = latestByPerson.get(id);
    if (level === "strong_yes" || level === "soft_yes") forUs++;
    else if (level === "strong_no" || level === "soft_no") againstUs++;
    else if (level === "undecided") undecided++;
    else notHome++;
  }

  const walkListProgress = walkLists.map((l) => ({
    id: l.id,
    name: l.name,
    totalEntries: l._count.entries,
    totalResponses: l.assignments.reduce((sum, a) => sum + a._count.responses, 0),
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
  };
}

// ── Field Organizer ────────────────────────────────────────────────────────

export async function getFieldOrganizerDashboardData(campaignId: string) {
  const todayStart = startOfToday();

  const [walkLists, doorsToday, unassignedFollowUpCount, canvasserActivityToday] =
    await Promise.all([
      db.canvassList.findMany({
        where: { campaignId, deletedAt: null },
        select: {
          id: true,
          name: true,
          _count: { select: { entries: true } },
          assignments: {
            select: {
              _count: { select: { responses: true } },
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
        where: { campaignId, completed: false, assignedTo: null },
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
    ]);

  // Enrich canvasser activity with names
  const assignmentIds = canvasserActivityToday.map((r) => r.assignmentId);
  const assignments =
    assignmentIds.length > 0
      ? await db.canvassAssignment.findMany({
          where: { id: { in: assignmentIds } },
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
    totalResponses: l.assignments.reduce((sum, a) => sum + a._count.responses, 0),
    canvassers: l.assignments.map((a) => a.canvasser),
  }));

  return { walkListProgress, doorsToday, unassignedFollowUpCount, activityToday };
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
            phone: true,
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
      where: { campaignId, completed: false },
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
