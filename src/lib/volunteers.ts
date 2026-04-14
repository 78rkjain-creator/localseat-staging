import { db } from "@/lib/db";

// ── Volunteer records ─────────────────────────────────────────────────────────

export async function getVolunteerRecords(campaignId: string) {
  return db.volunteerRecord.findMany({
    where: { campaignId, deletedAt: null },
    include: {
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
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getVolunteerCounts(campaignId: string) {
  const [interested, committed] = await Promise.all([
    db.volunteerRecord.count({ where: { campaignId, deletedAt: null, status: "interested" } }),
    db.volunteerRecord.count({ where: { campaignId, deletedAt: null, status: "committed" } }),
  ]);
  return { interested, committed, total: interested + committed };
}

// ── Volunteer shifts ──────────────────────────────────────────────────────────

export async function getVolunteerShifts(campaignId: string) {
  const shifts = await db.volunteerShift.findMany({
    where: { campaignId, deletedAt: null },
    include: {
      attendees: {
        include: {
          record: {
            select: {
              id: true,
              status: true,
              person: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  const now = new Date();
  return {
    upcoming: shifts.filter((s) => new Date(s.date) >= now),
    past: shifts.filter((s) => new Date(s.date) < now),
  };
}

export async function getVolunteerShiftDetail(shiftId: string, campaignId: string) {
  return db.volunteerShift.findFirst({
    where: { id: shiftId, campaignId, deletedAt: null },
    include: {
      attendees: {
        include: {
          record: {
            include: {
              person: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

// ── Dashboard summary ─────────────────────────────────────────────────────────

export async function getVolunteerDashboardData(campaignId: string) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [counts, upcomingShifts, pastAttendance] = await Promise.all([
    getVolunteerCounts(campaignId),
    db.volunteerShift.findMany({
      where: { campaignId, deletedAt: null, date: { gte: todayStart } },
      orderBy: { date: "asc" },
      take: 3,
      include: {
        _count: { select: { attendees: true } },
      },
    }),
    db.volunteerShiftAttendee.findMany({
      where: {
        shift: { campaignId, deletedAt: null, date: { lt: now } },
      },
      select: { status: true },
    }),
  ]);

  const totalAttended = pastAttendance.filter((a) => a.status === "attended").length;
  const totalPastAttendees = pastAttendance.filter((a) => a.status !== "pending").length;
  const attendanceRate =
    totalPastAttendees > 0 ? Math.round((totalAttended / totalPastAttendees) * 100) : null;

  return {
    counts,
    upcomingShifts,
    attendanceRate,
  };
}
