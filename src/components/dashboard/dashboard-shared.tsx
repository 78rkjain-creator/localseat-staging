import Link from "next/link";
import type { SeriesPoint } from "@/components/dashboard/sparkline-charts";
import { BarSparkline, LineSparkline } from "@/components/dashboard/sparkline-charts";

// ── Helpers ────────────────────────────────────────────────────────────────

export function splitCampaignName(name: string): { line1: string; line2?: string } {
  const separators = [" — ", " – ", " - ", ", "];
  for (const sep of separators) {
    const idx = name.indexOf(sep);
    if (idx > 0) {
      return {
        line1: name.slice(0, idx).trim(),
        line2: name.slice(idx + sep.length).trim(),
      };
    }
  }
  return { line1: name };
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  badge,
  badgeColor = "green",
  accent,
  children,
}: {
  label: string;
  value: string | number;
  badge?: string;
  badgeColor?: "green" | "amber";
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={[
      "bg-white rounded-xl p-4 flex flex-col",
      accent
        ? "border-l-[3px] border-l-brand-400 border-t border-r border-b border-slate-200"
        : "border border-slate-200",
    ].join(" ")}>
      <div className="flex items-start justify-between mb-1.5">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        {badge && (
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0 ${
              badgeColor === "green"
                ? "bg-[#dcfce7] text-[#16a34a]"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular leading-none mb-3">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {children}
    </div>
  );
}

export function KpiCardWithSparkline({
  label,
  value,
  badge,
  badgeColor = "green",
  accent,
  sparkType,
  sparkData,
  sparkColor,
  sparkHeight = 80,
  ySuffix,
}: {
  label: string;
  value: string | number;
  badge?: string;
  badgeColor?: "green" | "amber";
  accent?: boolean;
  sparkType: "bar" | "line";
  sparkData: SeriesPoint[];
  sparkColor?: string;
  sparkHeight?: number;
  ySuffix?: string;
}) {
  return (
    <KpiCard label={label} value={value} badge={badge} badgeColor={badgeColor} accent={accent}>
      {sparkType === "bar" ? (
        <BarSparkline data={sparkData} height={sparkHeight} />
      ) : (
        <LineSparkline data={sparkData} color={sparkColor} height={sparkHeight} ySuffix={ySuffix} />
      )}
    </KpiCard>
  );
}

export function GeoStatCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular leading-none mt-1.5">{value}</p>
      <p className="text-[11px] text-slate-400 mt-1">{description}</p>
    </div>
  );
}

export function ActionQueueItem({
  item,
}: {
  item: { id: string; label: string; count: number; priority: string; href: string };
}) {
  return (
    <Link
      href={item.href}
      className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-white transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={[
          "h-1.5 w-1.5 rounded-full flex-shrink-0",
          item.priority === "overdue" ? "bg-red-500" :
          item.priority === "today" ? "bg-amber-400" : "bg-slate-300",
        ].join(" ")} />
        <span className="text-sm text-slate-700 truncate">
          <span className="font-semibold">{item.count}</span> {item.label}
        </span>
      </div>
      <span className={[
        "text-[10px] font-semibold border rounded-full px-1.5 py-0.5 flex-shrink-0",
        item.priority === "overdue"
          ? "bg-red-50 text-red-600 border-red-200"
          : "bg-amber-50 text-amber-700 border-amber-200",
      ].join(" ")}>
        {item.priority === "overdue" ? "overdue" : "today"}
      </span>
    </Link>
  );
}

export function WalkListRow({
  list,
}: {
  list: { id: string; name: string; totalEntries: number; totalResponses: number };
}) {
  const pct = list.totalEntries > 0
    ? Math.min(100, Math.round((list.totalResponses / list.totalEntries) * 100))
    : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <Link
          href={`/canvassing/${list.id}`}
          className="text-sm font-medium text-slate-800 hover:text-slate-600 truncate"
        >
          {list.name}
        </Link>
        <span className="text-[11px] text-slate-500 flex-shrink-0 ml-2">
          {list.totalResponses}/{list.totalEntries}
        </span>
      </div>
      <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${
            pct >= 60 ? "bg-emerald-400" : pct >= 30 ? "bg-amber-400" : "bg-red-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function LeaderboardRow({
  rank,
  canvasser,
}: {
  rank: number;
  canvasser: {
    canvasserId: string;
    firstName: string;
    lastName: string;
    totalDoors: number;
    lastActive: string | null;
  };
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        rank === 1 ? "bg-amber-50/80" : "hover:bg-slate-50"
      }`}
    >
      <span className="text-[11px] font-bold text-slate-400 w-3 text-center flex-shrink-0">
        {rank}
      </span>
      <div
        className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
      >
        {canvasser.firstName[0]}{canvasser.lastName[0]}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-800 truncate">
          {canvasser.firstName} {canvasser.lastName}
        </p>
        {canvasser.lastActive && (
          <p className="text-[10px] text-slate-400">{relativeTime(canvasser.lastActive)}</p>
        )}
      </div>
      <span className="text-xs font-bold text-slate-700 tabular flex-shrink-0">
        {canvasser.totalDoors}
      </span>
    </div>
  );
}
