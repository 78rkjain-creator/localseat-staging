import Link from "next/link";
import { getFieldOrganizerDashData } from "@/lib/dashboard";

interface Props {
  campaignId: string;
  firstName: string;
  userId: string;
}

export async function FieldOrganizerDashboard({ campaignId, userId }: Props) {
  const {
    lists,
    canvassers,
    pendingApprovalCount,
    openFollowUpCount,
    notHomeRateThisWeek,
    notHomeRatePrevWeek,
    notHomeRateDelta,
  } = await getFieldOrganizerDashData(campaignId, userId);

  const doorsToday = canvassers.reduce((s, c) => s + c.doorsToday, 0);
  const totalEntries = lists.reduce((s, l) => s + l.totalEntries, 0);
  const totalResponded = lists.reduce((s, l) => s + l.responded, 0);
  const canvassersActiveToday = canvassers.filter((c) => c.doorsToday > 0).length;
  const overallPct = totalEntries > 0 ? Math.min(100, Math.round((totalResponded / totalEntries) * 100)) : 0;

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
              My field operations
            </p>
            <p className="text-[28px] font-extrabold text-white leading-none mb-2">
              {lists.length} active list{lists.length !== 1 ? "s" : ""} · {totalEntries.toLocaleString()} entries
            </p>
            <p className="text-sm text-white/50">
              {canvassersActiveToday} canvasser{canvassersActiveToday !== 1 ? "s" : ""} in the field today
            </p>
          </div>
          {/* Right — overall completion */}
          <div className="flex-shrink-0 text-right">
            <p className="text-[11px] text-white/40 uppercase tracking-widest mb-1">Overall completion</p>
            <p className="text-4xl font-extrabold leading-none mb-2" style={{ color: "#86efac" }}>
              {overallPct}%
            </p>
            <div className="w-40 h-1.5 rounded-full bg-white/10 overflow-hidden ml-auto">
              <div
                className="h-full rounded-full"
                style={{ width: `${overallPct}%`, background: "#86efac" }}
              />
            </div>
            <p className="text-[10px] text-white/30 mt-1">
              {totalResponded.toLocaleString()} / {totalEntries.toLocaleString()} doors
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Doors today" value={doorsToday} highlight={doorsToday > 0} />
        <KpiCard
          label="Pending approval"
          value={pendingApprovalCount}
          highlight={pendingApprovalCount > 0}
          highlightColor="amber"
          action={pendingApprovalCount > 0 ? { href: "/canvassing", label: "Review now →" } : undefined}
        />
        <KpiCard
          label="My follow-ups"
          value={openFollowUpCount}
          highlight={openFollowUpCount > 0}
          highlightColor="amber"
          action={openFollowUpCount > 0 ? { href: "/follow-ups", label: "View queue →" } : undefined}
        />
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Not-home rate</p>
          <p className="text-[22px] font-bold text-slate-900 tabular leading-none mb-1">
            {notHomeRateThisWeek}%
          </p>
          <p className={`text-[11px] font-semibold ${
            notHomeRateDelta > 0 ? "text-red-500" : notHomeRateDelta < 0 ? "text-emerald-600" : "text-slate-400"
          }`}>
            {notHomeRateDelta > 0 ? `+${notHomeRateDelta}%` : notHomeRateDelta < 0 ? `${notHomeRateDelta}%` : "—"} vs last week
          </p>
        </div>
      </div>

      {/* ── Two panels ── */}
      <div className="grid grid-cols-12 gap-3">

        {/* My walk lists — col-span-7 */}
        <div className="col-span-7 bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">My walk lists</p>
            <Link href="/canvassing" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">manage →</Link>
          </div>
          {lists.length === 0 ? (
            <p className="text-sm text-slate-400">No walk lists created yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {lists.map((l) => {
                const pct = l.completionPct;
                return (
                  <div key={l.id}>
                    <div className="flex items-center justify-between mb-1">
                      <Link
                        href={`/canvassing/${l.id}`}
                        className="text-sm font-medium text-slate-800 hover:text-slate-600 truncate"
                      >
                        {l.name}
                      </Link>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span className="text-[11px] text-slate-500">
                          {l.responded}/{l.totalEntries}
                        </span>
                        <span className={`text-[11px] font-semibold ${
                          pct >= 60 ? "text-emerald-600" : pct >= 30 ? "text-amber-600" : "text-red-500"
                        }`}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 60 ? "bg-emerald-400" : pct >= 30 ? "bg-amber-400" : "bg-red-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My canvassers today — col-span-5 */}
        <div className="col-span-5 bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">My canvassers today</p>
          </div>
          {canvassers.length === 0 ? (
            <p className="text-sm text-slate-400">No canvassers assigned yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {canvassers.slice(0, 8).map((c) => {
                const isActive = c.doorsToday > 0;
                const lastActiveText = c.lastActive ? relativeTime(c.lastActive) : null;
                return (
                  <div key={c.id} className="flex items-center gap-2.5">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
                    >
                      {c.firstName[0]}{c.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {c.firstName} {c.lastName}
                      </p>
                      {lastActiveText && (
                        <p className="text-[10px] text-slate-400">Last seen {lastActiveText}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.doorsToday > 0 && (
                        <span className="text-sm font-bold text-slate-700 tabular">
                          {c.doorsToday}
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-50 text-slate-500 border-slate-200"
                      }`}>
                        {isActive ? "Active" : lastActiveText ? `${lastActiveText}` : "Idle"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  highlight = false,
  highlightColor = "orange",
  action,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  highlightColor?: "orange" | "amber";
  action?: { href: string; label: string };
}) {
  const valueColor = !highlight
    ? "text-slate-900"
    : highlightColor === "amber"
    ? "text-amber-500"
    : "text-brand-500";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-[22px] font-bold tabular leading-none mb-1 ${valueColor}`}>
        {value.toLocaleString()}
      </p>
      {action && (
        <Link href={action.href} className="text-[11px] text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900">
          {action.label}
        </Link>
      )}
    </div>
  );
}
