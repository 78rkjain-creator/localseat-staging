import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getCandidateDashboardData } from "@/lib/dashboard";
import { getRecentActivity } from "@/lib/activity";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import type { DonorStatus, OutreachChannel, Role } from "@/types";
import { ROLE_LABELS, OUTREACH_CHANNEL_LABELS, DONOR_STATUS_LABELS } from "@/types";

interface Props {
  campaignId: string;
  firstName: string;
  role: Role;
}

export async function CandidateDashboard({ campaignId, firstName, role }: Props) {
  const [data, activityEntries] = await Promise.all([
    getCandidateDashboardData(campaignId),
    getRecentActivity(campaignId, 20),
  ]);
  const {
    total, forUs, againstUs, undecided, notHome, uncontacted,
    doorsTotal, doorsToday, walkListProgress,
    followUpSummary, donorCountByStatus, recentOutreach, teamMembers,
    pendingAddressChangeCount,
  } = data;

  const idd = forUs + againstUs + undecided;
  const supportRate = idd > 0 ? Math.round((forUs / idd) * 100) : null;

  function pct(n: number) {
    return total === 0 ? "—" : `${Math.round((n / total) * 100)}%`;
  }

  // Group team by role
  const teamByRole = new Map<string, string[]>();
  for (const m of teamMembers) {
    const label = ROLE_LABELS[m.role as Role] ?? m.role;
    if (!teamByRole.has(label)) teamByRole.set(label, []);
    teamByRole.get(label)!.push(`${m.user.firstName} ${m.user.lastName}`);
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Good to see you, {firstName}</h1>
        <p className="text-slate-500 mt-1">{ROLE_LABELS[role]}</p>
      </div>

      {/* Pending address changes alert */}
      {pendingAddressChangeCount > 0 && (
        <Link
          href="/address-changes"
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 hover:bg-amber-100 transition-colors"
        >
          <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {pendingAddressChangeCount} pending address change{pendingAddressChangeCount !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-600">Review and approve or reject →</p>
          </div>
        </Link>
      )}

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Doors knocked" value={doorsTotal} />
        <MetricCard label="Today" value={doorsToday} highlight={doorsToday > 0} />
        <MetricCard label="Voters on file" value={total} />
        {supportRate !== null ? (
          <Card padding="md">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Support rate</p>
            <p className="text-xs text-slate-400 mb-2">Of ID&apos;d voters</p>
            <p className="text-3xl font-bold text-brand-500">{supportRate}%</p>
          </Card>
        ) : (
          <MetricCard label="Support rate" value={0} />
        )}
      </div>

      {/* ID breakdown */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Voter ID breakdown
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <IdCard label="For us" sublabel="Strong + Soft Yes" value={forUs} pct={pct(forUs)} color="emerald" />
        <IdCard label="Undecided" sublabel="Persuadable" value={undecided} pct={pct(undecided)} color="amber" />
        <IdCard label="Against us" sublabel="Strong + Soft No" value={againstUs} pct={pct(againstUs)} color="red" />
        <IdCard label="Not home" sublabel="No level captured" value={notHome} pct={pct(notHome)} color="slate" />
        <IdCard label="Not contacted" sublabel="No canvass record" value={uncontacted} pct={pct(uncontacted)} color="slate" />
      </div>

      {/* Progress bar */}
      {idd > 0 && (
        <div className="mb-8">
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
            <div className="h-full bg-emerald-500" style={{ width: `${(forUs / idd) * 100}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${(undecided / idd) * 100}%` }} />
            <div className="h-full bg-red-400" style={{ width: `${(againstUs / idd) * 100}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-1.5 text-center">
            Based on {idd.toLocaleString()} ID&apos;d voter{idd !== 1 ? "s" : ""} (excludes not home and uncontacted)
          </p>
        </div>
      )}

      {/* Walk list progress */}
      {walkListProgress.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Walk lists</h2>
            <Link href="/canvassing" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</Link>
          </div>
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">List</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Canvassers</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {walkListProgress.map((l) => {
                  const pctDone = l.totalEntries > 0 ? Math.round((l.totalResponses / l.totalEntries) * 100) : 0;
                  return (
                    <tr key={l.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <Link href={`/canvassing/${l.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                          {l.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                        {l.canvasserNames.length > 0 ? l.canvasserNames.join(", ") : (
                          <span className="text-slate-300">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-slate-700">{l.totalResponses}/{l.totalEntries}</span>
                        <span className="text-xs text-slate-400 ml-1.5">{pctDone}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Follow-ups + Donor pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">Follow-up queue</h2>
            <Link href="/follow-ups" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</Link>
          </div>
          {followUpSummary.overdue.length === 0 && followUpSummary.dueToday.length === 0 ? (
            <p className="text-sm text-slate-400">No tasks due today or overdue.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {followUpSummary.overdue.map((task) => (
                <FollowUpRow key={task.id} task={task} badge="Overdue" badgeStyle="bg-red-50 text-red-600 border-red-200" />
              ))}
              {followUpSummary.dueToday.map((task) => (
                <FollowUpRow key={task.id} task={task} badge="Today" badgeStyle="bg-amber-50 text-amber-700 border-amber-200" />
              ))}
              {followUpSummary.upcomingCount > 0 && (
                <p className="text-xs text-slate-400 pt-1">+{followUpSummary.upcomingCount} upcoming</p>
              )}
            </div>
          )}
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">Donor pipeline</h2>
            <Link href="/donors" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</Link>
          </div>
          {Object.keys(donorCountByStatus).length === 0 ? (
            <p className="text-sm text-slate-400">No donors recorded yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {(["interested", "pledged", "received"] as DonorStatus[]).map((s) => (
                <div key={s} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{DONOR_STATUS_LABELS[s]}</span>
                  <span className="text-sm font-semibold text-slate-900">{donorCountByStatus[s] ?? 0}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity feed */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent activity</h2>
        <Card padding="md">
          <RecentActivityFeed entries={activityEntries} />
        </Card>
      </div>

      {/* Recent outreach + Team */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">Recent outreach</h2>
            <Link href="/outreach" className="text-xs font-medium text-brand-600 hover:text-brand-700">View all →</Link>
          </div>
          {recentOutreach.length === 0 ? (
            <p className="text-sm text-slate-400">No outreach recorded yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {recentOutreach.map((log) => (
                <li key={log.id} className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ChannelDot channel={log.channel as OutreachChannel} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">
                      {log.person ? `${log.person.firstName} ${log.person.lastName}` : "Unknown"}
                      {log.outcome && <span className="text-slate-400"> — {log.outcome}</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {OUTREACH_CHANNEL_LABELS[log.channel as OutreachChannel] ?? log.channel}
                      {log.user ? ` · ${log.user.firstName} ${log.user.lastName}` : ""}
                      {" · "}{new Date(log.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">Team</h2>
            <Link href="/team" className="text-xs font-medium text-brand-600 hover:text-brand-700">View →</Link>
          </div>
          <div className="flex flex-col gap-3">
            {Array.from(teamByRole.entries()).map(([roleLabel, names]) => (
              <div key={roleLabel}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{roleLabel}</p>
                <div className="flex flex-col gap-0.5">
                  {names.map((name) => (
                    <p key={name} className="text-sm text-slate-700">{name}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

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

function IdCard({ label, sublabel, value, pct, color }: {
  label: string; sublabel?: string; value: number; pct?: string;
  color: "emerald" | "red" | "amber" | "slate";
}) {
  const accent = { emerald: "text-emerald-600", red: "text-red-600", amber: "text-amber-600", slate: "text-slate-700" };
  return (
    <Card padding="md" className="flex flex-col justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
        {sublabel && <p className="text-[11px] text-slate-400 mb-2">{sublabel}</p>}
      </div>
      <div className="flex items-end justify-between gap-1">
        <p className={["text-2xl font-bold", accent[color]].join(" ")}>{value.toLocaleString()}</p>
        {pct && <p className="text-xs font-medium text-slate-400 mb-0.5">{pct}</p>}
      </div>
    </Card>
  );
}

function FollowUpRow({ task, badge, badgeStyle }: {
  task: { id: string; title: string; person?: { firstName: string; lastName: string } | null; assignee?: { firstName: string; lastName: string } | null };
  badge: string; badgeStyle: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">
          {task.person ? `${task.person.firstName} ${task.person.lastName}` : task.title}
        </p>
        {task.assignee && (
          <p className="text-xs text-slate-400 truncate">→ {task.assignee.firstName} {task.assignee.lastName}</p>
        )}
      </div>
      <span className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 flex-shrink-0 ${badgeStyle}`}>{badge}</span>
    </div>
  );
}

function ChannelDot({ channel }: { channel: OutreachChannel }) {
  const colors: Record<OutreachChannel, string> = {
    door_knock: "bg-brand-100",
    phone_call: "bg-emerald-100",
    email: "bg-blue-100",
    text_message: "bg-violet-100",
    in_person: "bg-amber-100",
    other: "bg-slate-100",
  };
  return <span className={`h-2 w-2 rounded-full ${colors[channel] ?? "bg-slate-200"}`} />;
}
