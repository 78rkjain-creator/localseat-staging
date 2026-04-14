import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getFieldOrganizerDashboardData } from "@/lib/dashboard";
import { getRecentActivity } from "@/lib/activity";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import { ROLE_LABELS } from "@/types";

interface Props {
  campaignId: string;
  firstName: string;
}

export async function FieldOrganizerDashboard({ campaignId, firstName }: Props) {
  const [data, activityEntries] = await Promise.all([
    getFieldOrganizerDashboardData(campaignId),
    getRecentActivity(campaignId, 20),
  ]);
  const { walkListProgress, doorsToday, unassignedFollowUpCount, activityToday } = data;

  const totalEntries = walkListProgress.reduce((s, l) => s + l.totalEntries, 0);
  const totalResponses = walkListProgress.reduce((s, l) => s + l.totalResponses, 0);
  const overallPct = totalEntries > 0 ? Math.round((totalResponses / totalEntries) * 100) : 0;

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Good to see you, {firstName}</h1>
        <p className="text-slate-500 mt-1">{ROLE_LABELS["field_organizer"]}</p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Doors today" value={doorsToday} highlight={doorsToday > 0} />
        <MetricCard label="Total doors" value={totalResponses} />
        <MetricCard label="Lists active" value={walkListProgress.length} />
        <Card padding="md">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Unassigned follow-ups</p>
          {unassignedFollowUpCount > 0 ? (
            <>
              <p className="text-3xl font-bold text-amber-500">{unassignedFollowUpCount}</p>
              <Link href="/follow-ups" className="text-xs text-brand-600 hover:underline mt-1 block">
                Assign now →
              </Link>
            </>
          ) : (
            <p className="text-3xl font-bold text-slate-900">0</p>
          )}
        </Card>
      </div>

      {/* Overall progress bar */}
      {totalEntries > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1.5 text-xs text-slate-500">
            <span>Campaign progress</span>
            <span>{totalResponses.toLocaleString()} / {totalEntries.toLocaleString()} doors ({overallPct}%)</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Walk list table */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Walk lists</h2>
          <Link href="/canvassing" className="text-xs font-medium text-brand-600 hover:text-brand-700">Manage →</Link>
        </div>

        {walkListProgress.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-slate-400">No walk lists created yet.</p>
          </Card>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">List</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Canvassers</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {walkListProgress.map((l) => {
                  const pct = l.totalEntries > 0 ? Math.round((l.totalResponses / l.totalEntries) * 100) : 0;
                  const complete = l.totalEntries > 0 && l.totalResponses >= l.totalEntries;
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/canvassing/${l.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                            {l.name}
                          </Link>
                          {complete && (
                            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-1.5 py-0.5">Done</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                        {l.canvassers.length > 0
                          ? l.canvassers.map((c) => `${c.firstName} ${c.lastName}`).join(", ")
                          : <span className="text-slate-300">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <div className="hidden sm:block w-20">
                            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-brand-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            {l.totalResponses}/{l.totalEntries}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Recent activity feed */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent activity</h2>
        <Card padding="md">
          <RecentActivityFeed entries={activityEntries} />
        </Card>
      </div>

      {/* Canvasser activity today */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="md">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Canvasser activity today</h2>
          {activityToday.length === 0 ? (
            <p className="text-sm text-slate-400">No door knocks recorded today yet.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {activityToday.map((a, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{a.canvasser.firstName} {a.canvasser.lastName}</span>
                  <span className="text-sm font-semibold text-slate-900">{a.doorsKnocked} door{a.doorsKnocked !== 1 ? "s" : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">Follow-ups</h2>
            <Link href="/follow-ups" className="text-xs font-medium text-brand-600 hover:text-brand-700">View queue →</Link>
          </div>
          {unassignedFollowUpCount === 0 ? (
            <p className="text-sm text-slate-400">No unassigned follow-up tasks.</p>
          ) : (
            <div className="flex items-center gap-3 py-2">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-amber-600">{unassignedFollowUpCount}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Unassigned task{unassignedFollowUpCount !== 1 ? "s" : ""}</p>
                <p className="text-xs text-slate-400">Need to be assigned to a team member</p>
              </div>
            </div>
          )}
        </Card>
      </div>
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
