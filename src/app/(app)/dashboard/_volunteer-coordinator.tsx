import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getVolunteerDashboardData } from "@/lib/volunteers";
import { ROLE_LABELS } from "@/types";

interface Props {
  campaignId: string;
  firstName: string;
}

export async function VolunteerCoordinatorDashboard({ campaignId, firstName }: Props) {
  const { counts, upcomingShifts, attendanceRate } = await getVolunteerDashboardData(campaignId);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Good to see you, {firstName}</h1>
        <p className="text-slate-500 mt-1">{ROLE_LABELS["volunteer_coordinator"]}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total volunteers" value={counts.total} highlight={counts.total > 0} />
        <MetricCard label="Interested" value={counts.interested} />
        <MetricCard label="Committed" value={counts.committed} highlight={counts.committed > 0} />
        <Card padding="md">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Attendance rate</p>
          {attendanceRate !== null ? (
            <p className="text-3xl font-bold text-slate-900">{attendanceRate}%</p>
          ) : (
            <p className="text-sm text-slate-400 mt-2">No past shifts yet</p>
          )}
        </Card>
      </div>

      {/* Upcoming shifts */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Upcoming shifts
          </h2>
          <Link href="/volunteers/schedule" className="text-xs font-medium text-brand-600 hover:text-brand-700">
            Manage schedule →
          </Link>
        </div>

        {upcomingShifts.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-slate-400">
              No upcoming shifts scheduled.{" "}
              <Link href="/volunteers/schedule" className="text-brand-600 hover:underline">
                Create one
              </Link>
              .
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {upcomingShifts.map((shift) => {
              const dateStr = new Date(shift.date).toLocaleDateString("en-CA", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              return (
                <Card key={shift.id} padding="md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{shift.name}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {dateStr} · {shift.startTime}–{shift.endTime}
                        {shift.location && ` · ${shift.location}`}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-lg font-bold text-slate-900">{shift._count.attendees}</p>
                      <p className="text-xs text-slate-400">
                        {shift.maxVolunteers ? `/ ${shift.maxVolunteers}` : "assigned"}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Export */}
      <Card padding="md" className="inline-flex items-center gap-3">
        <div>
          <p className="text-sm font-medium text-slate-800">Volunteer list</p>
          <p className="text-xs text-slate-400 mt-0.5">Export all volunteer contacts to CSV</p>
        </div>
        <a
          href="/api/volunteers/export"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          Export CSV
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card padding="md">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={["text-3xl font-bold", highlight ? "text-brand-500" : "text-slate-900"].join(" ")}>
        {value.toLocaleString()}
      </p>
    </Card>
  );
}
