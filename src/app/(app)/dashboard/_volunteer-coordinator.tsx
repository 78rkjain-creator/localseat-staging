import Link from "next/link";
import { db } from "@/lib/db";
import {
  getVolunteerCoordDashData,
  getVolunteerCoordinatorDashboardData,
} from "@/lib/dashboard";
import { BarSparkline } from "@/components/dashboard/sparkline-charts";

interface Props {
  campaignId: string;
  firstName: string;
}

export async function VolunteerCoordinatorDashboard({ campaignId }: Props) {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [coordData, legacyData, recentSignups] = await Promise.all([
    getVolunteerCoordDashData(campaignId),
    getVolunteerCoordinatorDashboardData(campaignId),
    db.canvassResponse.findMany({
      where: {
        person: { campaignId, deletedAt: null },
        volunteerInterest: true,
      },
      distinct: ["personId"],
      orderBy: { respondedAt: "desc" },
      take: 5,
      select: {
        respondedAt: true,
        person: {
          select: { id: true, firstName: true, lastName: true, email: true, phoneHome: true },
        },
      },
    }),
  ]);

  const {
    volunteerCount,
    newSignupsThisWeek,
    shifts,
    attendanceRate,
    volunteerFollowUps,
    signupsSeries,
  } = coordData;

  const upcomingShiftsCount = shifts.length;
  const needsVolunteersCount = shifts.filter((s) =>
    s.maxVolunteers ? s.signupCount < s.maxVolunteers : s.signupCount === 0
  ).length;

  void legacyData;

  return (
    <div className="px-4 py-4 space-y-3">

      {/* ── Hero band ── */}
      <div
        className="rounded-2xl px-5 py-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1e293b, #334155)" }}
      >
        <div className="absolute bottom-0 right-0 w-28 h-28 rounded-full bg-orange-500/10 translate-x-10 translate-y-8 pointer-events-none" />
        <div className="flex items-start justify-between gap-6">
          {/* Left */}
          <div>
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">
              Volunteer operations
            </p>
            <p className="text-[28px] font-extrabold text-white leading-none mb-2">
              {volunteerCount.toLocaleString()} active volunteers
            </p>
            <p className="text-sm text-white/50">
              {newSignupsThisWeek} new sign-ups this week{" "}
              {attendanceRate > 0 && (
                <span>· {attendanceRate}% attendance rate</span>
              )}
            </p>
          </div>
          {/* Right — upcoming shifts */}
          <div className="flex-shrink-0 text-right">
            <p className="text-[11px] text-white/40 uppercase tracking-widest mb-2">This week's shifts</p>
            <div className="flex items-end gap-5">
              <div className="text-center">
                <p className="text-2xl font-bold text-white tabular">{upcomingShiftsCount}</p>
                <p className="text-[10px] text-white/40 mt-0.5">scheduled</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold tabular" style={{ color: needsVolunteersCount > 0 ? "#fbbf24" : "#86efac" }}>
                  {needsVolunteersCount}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: needsVolunteersCount > 0 ? "#fbbf24" : "#86efac" }}>
                  needs volunteers
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Total volunteers</p>
          <p className="text-[22px] font-bold text-slate-900 tabular leading-none">{volunteerCount.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">New this week</p>
          <p className="text-[22px] font-bold tabular leading-none" style={{ color: newSignupsThisWeek > 0 ? "#16a34a" : "#0f172a" }}>
            {newSignupsThisWeek}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Need onboarding</p>
          <p className={`text-[22px] font-bold tabular leading-none ${volunteerFollowUps > 0 ? "text-amber-500" : "text-slate-900"}`}>
            {volunteerFollowUps}
          </p>
          {volunteerFollowUps > 0 && (
            <Link href="/follow-ups" className="text-[11px] text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900 mt-1 block">
              View tasks →
            </Link>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Attendance rate</p>
          {attendanceRate > 0 ? (
            <p className="text-[22px] font-bold text-slate-900 tabular leading-none">{attendanceRate}%</p>
          ) : (
            <p className="text-sm text-slate-400 mt-1">No past shifts</p>
          )}
        </div>
      </div>

      {/* ── Two panels ── */}
      <div className="grid grid-cols-12 gap-3">

        {/* Upcoming shifts — col-span-5 */}
        <div className="col-span-5 bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Upcoming shifts</p>
            <Link href="/volunteers/schedule" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">manage →</Link>
          </div>
          {shifts.length === 0 ? (
            <p className="text-sm text-slate-400">No shifts scheduled this week.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {shifts.map((shift) => {
                const capacity = shift.maxVolunteers;
                const fill = shift.signupCount;
                const pct = capacity ? Math.round((fill / capacity) * 100) : 0;
                const isFull = capacity ? fill >= capacity : false;
                const isEmpty = fill === 0;
                const badgeStyle = isFull
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isEmpty
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-amber-50 text-amber-700 border-amber-200";

                return (
                  <div key={shift.id} className="px-2.5 py-2.5 rounded-lg bg-slate-50">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{shift.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {shift.date} · {shift.startTime}
                          {shift.endTime ? `–${shift.endTime}` : ""}
                          {shift.location ? ` · ${shift.location}` : ""}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${badgeStyle}`}>
                        {fill}{capacity ? `/${capacity}` : ""}
                      </span>
                    </div>
                    {capacity && (
                      <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isFull ? "bg-emerald-400" : isEmpty ? "bg-red-400" : "bg-amber-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* New sign-ups + chart — col-span-7 */}
        <div className="col-span-7 bg-white border border-slate-200 rounded-xl p-3 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">New volunteer sign-ups</p>
            <a
              href="/api/volunteers/export"
              className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              export CSV →
            </a>
          </div>
          {recentSignups.length === 0 ? (
            <p className="text-sm text-slate-400 mb-4">No volunteer sign-ups yet.</p>
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {recentSignups.map(({ person, respondedAt }) => {
                const dateStr = new Date(respondedAt).toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                });
                const initials = `${person.firstName[0]}${person.lastName[0]}`;
                return (
                  <div key={person.id} className="flex items-center gap-2.5">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/people/${person.id}`}
                        className="text-sm font-medium text-slate-800 hover:text-slate-600 truncate block"
                      >
                        {person.firstName} {person.lastName}
                      </Link>
                      <p className="text-[10px] text-slate-400">
                        {person.email || person.phoneHome || "No contact info"} · {dateStr}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 flex-shrink-0">
                      Volunteer
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-auto">
            <p className="text-[10px] text-slate-400 mb-1">Volunteer activity · 7-day sign-ups</p>
            <BarSparkline data={signupsSeries} height={60} />
          </div>
        </div>
      </div>
    </div>
  );
}
