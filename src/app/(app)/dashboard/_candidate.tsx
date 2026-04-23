import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getCandidateDashboardData, getNeedsYouQueue } from "@/lib/dashboard";
import { getRecentActivity } from "@/lib/activity";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import type { DonorStatus, OutreachChannel, Role } from "@/types";
import { ROLE_LABELS, OUTREACH_CHANNEL_LABELS, DONOR_STATUS_LABELS } from "@/types";

interface Props {
  campaignId: string;
  firstName: string;
  role: Role;
}

export async function CandidateDashboard({ campaignId }: Props) {
  const [data, activityEntries, needsYouQueue] = await Promise.all([
    getCandidateDashboardData(campaignId),
    getRecentActivity(campaignId, 20),
    getNeedsYouQueue(campaignId),
  ]);
  const {
    total, forUs, againstUs, undecided, notHome, uncontacted,
    doorsTotal, doorsToday, walkListProgress,
    followUpSummary, donorCountByStatus, recentOutreach, teamMembers,
    canvassersOutToday, competitorBreakdown, votersWithHistory,
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
      {/* ── Hero card ── */}
      <div className="bg-slate-900 rounded-3xl px-6 py-5 mb-8 relative overflow-hidden">
        {/* Soft orange glow in bottom-right corner */}
        <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full bg-brand-500 opacity-20 translate-x-12 translate-y-12 pointer-events-none" />

        {/* Eyebrow */}
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
          Campaign summary
        </p>

        {/* Status headline — derived from support rate */}
        <p className="text-[28px] font-extrabold text-white leading-tight mb-4 display">
          {supportRate !== null
            ? supportRate >= 55 ? `Ahead · ${supportRate}% support rate`
            : supportRate >= 45 ? `On pace · ${supportRate}% support rate`
            : `Behind pace · ${supportRate}% support rate`
            : "No voter ID data yet"}
        </p>

        {/* Three stats */}
        <div className="flex items-end gap-8">
          <div>
            <p className="text-2xl font-bold text-white tabular">{doorsToday}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">doors today</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white tabular">{doorsTotal.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">total doors</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white tabular">{canvassersOutToday}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">canvassers out today</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white tabular">{votersWithHistory.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">voters with history</p>
          </div>
        </div>
      </div>

      {/* ── Voter ID mix + Needs-you queue ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">

        {/* Donut ring — voter ID mix */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Voter ID mix</h2>
            <Link href="/voter-list" className="text-xs font-medium text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900">details →</Link>
          </div>
          <div className="flex items-center gap-6">
            {/* SVG donut — hand-rolled, no chart library */}
            <svg width="80" height="80" viewBox="0 0 80 80" className="flex-shrink-0">
              {(() => {
                const total = forUs + undecided + againstUs;
                if (total === 0) {
                  return <circle cx="40" cy="40" r="30" fill="none" stroke="#e2e8f0" strokeWidth="12" />;
                }
                const segments = [
                  { value: forUs, color: "#10b981" },
                  { value: undecided, color: "#f59e0b" },
                  { value: againstUs, color: "#ef4444" },
                ];
                let offset = 0;
                const circumference = 2 * Math.PI * 30;
                return segments.map((seg, i) => {
                  const pctSeg = seg.value / total;
                  const dash = pctSeg * circumference;
                  const gap = circumference - dash;
                  const rotation = offset * 360 - 90;
                  offset += pctSeg;
                  return (
                    <circle
                      key={i}
                      cx="40" cy="40" r="30"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="12"
                      strokeDasharray={`${dash} ${gap}`}
                      strokeDashoffset="0"
                      transform={`rotate(${rotation} 40 40)`}
                    />
                  );
                });
              })()}
              {supportRate !== null && (
                <>
                  <text x="40" y="37" textAnchor="middle" className="tabular" style={{ fontSize: 14, fontWeight: 700, fill: "#0f172a" }}>{supportRate}%</text>
                  <text x="40" y="50" textAnchor="middle" style={{ fontSize: 9, fill: "#94a3b8" }}>for us</text>
                </>
              )}
            </svg>
            {/* Legend */}
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 flex-shrink-0" /><span className="text-slate-600">For us</span><span className="ml-auto font-semibold text-slate-900 tabular pl-4">{forUs.toLocaleString()}</span></div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400 flex-shrink-0" /><span className="text-slate-600">Undecided</span><span className="ml-auto font-semibold text-slate-900 tabular pl-4">{undecided.toLocaleString()}</span></div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-400 flex-shrink-0" /><span className="text-slate-600">Against</span><span className="ml-auto font-semibold text-slate-900 tabular pl-4">{againstUs.toLocaleString()}</span></div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-200 flex-shrink-0" /><span className="text-slate-400">Not home</span><span className="ml-auto font-semibold text-slate-400 tabular pl-4">{notHome.toLocaleString()}</span></div>
            </div>
          </div>
        </Card>

        {/* Needs-you queue */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Needs you</h2>
            <Link href="/follow-ups" className="text-xs font-medium text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900">queue →</Link>
          </div>
          {needsYouQueue.length === 0 ? (
            <p className="text-sm text-slate-400">All clear — nothing needs you right now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {needsYouQueue.slice(0, 5).map((item) => (
                <Link key={item.id} href={item.href} className="flex items-center justify-between gap-3 py-1.5 hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={[
                      "h-2 w-2 rounded-full flex-shrink-0",
                      item.priority === "overdue" ? "bg-red-500" :
                      item.priority === "today" ? "bg-amber-400" : "bg-slate-300",
                    ].join(" ")} />
                    <span className="text-sm text-slate-700 truncate">{item.count} {item.label}</span>
                  </div>
                  <span className={[
                    "text-[11px] font-semibold border rounded-full px-2 py-0.5 flex-shrink-0",
                    item.priority === "overdue" ? "bg-red-50 text-red-600 border-red-200" :
                    "bg-amber-50 text-amber-700 border-amber-200",
                  ].join(" ")}>
                    {item.priority === "overdue" ? "overdue" : "today"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Doors knocked" value={doorsTotal} />
        <MetricCard label="Today" value={doorsToday} highlight={doorsToday > 0} />
        <MetricCard label="Voters on file" value={total} />
        {supportRate !== null ? (
          <Card padding="md">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Support rate</p>
            <p className="text-xs text-slate-400 mb-2">Of ID&apos;d voters</p>
            <p className={`text-3xl font-bold ${supportRate >= 50 ? "text-emerald-600" : supportRate >= 30 ? "text-amber-600" : "text-red-600"}`}>{supportRate}%</p>
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

      {/* Competitor breakdown */}
      {competitorBreakdown.length > 0 && (
        <Card padding="sm" className="mb-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Supporting other candidates
          </h2>
          <div className="flex flex-col gap-2">
            {competitorBreakdown.slice(0, 5).map((c) => (
              <div key={c.name} className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{c.name}</span>
                <span className="text-sm font-semibold text-slate-900 tabular">{c.count}</span>
              </div>
            ))}
            {competitorBreakdown.length > 5 && (
              <p className="text-xs text-slate-400 pt-1">+{competitorBreakdown.length - 5} more</p>
            )}
          </div>
        </Card>
      )}

      {/* Walk list progress */}
      {walkListProgress.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Walk lists</h2>
            <Link href="/canvassing" className="text-xs font-medium text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900">View all →</Link>
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
                        <Link href={`/canvassing/${l.id}`} className="font-medium text-slate-900 hover:text-slate-600">
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
            <Link href="/follow-ups" className="text-xs font-medium text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900">View all →</Link>
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
            <Link href="/donors" className="text-xs font-medium text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900">View all →</Link>
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
            <Link href="/outreach" className="text-xs font-medium text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900">View all →</Link>
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
            <Link href="/team" className="text-xs font-medium text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900">View →</Link>
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
      <p className="text-3xl font-bold text-slate-900">
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
