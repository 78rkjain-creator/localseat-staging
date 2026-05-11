import type { SeriesPoint } from "@/components/dashboard/sparkline-charts";
import { LineSparkline } from "@/components/dashboard/sparkline-charts";

interface SupportersTabProps {
  forUs: number;
  againstUs: number;
  undecided: number;
  notHome: number;
  uncontacted: number;
  totalPeople: number;
  supportRate: number;
  supportDelta: number | null;
  reachedPct: number;
  supportRateSeries: SeriesPoint[];
  competitorBreakdown: { name: string; count: number }[];
}

function SentimentBlock({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="text-center">
      <div
        className="h-14 rounded-lg flex items-end justify-center pb-1"
        style={{ background: `${color}18` }}
      >
        <span
          className="text-lg font-bold tabular"
          style={{ color }}
        >
          {value.toLocaleString()}
        </span>
      </div>
      <p className="text-[10px] text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export function SupportersTab({
  forUs,
  againstUs,
  undecided,
  notHome,
  uncontacted,
  totalPeople,
  supportRate,
  supportDelta,
  reachedPct,
  supportRateSeries,
  competitorBreakdown,
}: SupportersTabProps) {
  const idTotal = forUs + againstUs + undecided;

  return (
    <div className="flex flex-col gap-3">
      {/* Full voter ID breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Full voter ID breakdown
        </p>
        {idTotal > 0 ? (
          <>
            <div className="grid grid-cols-5 gap-3 mb-4">
              <SentimentBlock label="Strong yes" value={forUs} color="#10b981" />
              <SentimentBlock label="Undecided" value={undecided} color="#f59e0b" />
              <SentimentBlock label="Against" value={againstUs} color="#ef4444" />
              <SentimentBlock label="Not home" value={notHome} color="#cbd5e1" />
              <SentimentBlock label="Uncontacted" value={uncontacted} color="#e2e8f0" />
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-500">
              <span>
                <span className="font-semibold text-slate-700">{idTotal.toLocaleString()}</span> ID'd total
              </span>
              <span>·</span>
              <span>
                <span className="font-semibold text-slate-700">{totalPeople.toLocaleString()}</span> total people
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">No voter ID data yet.</p>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total people</p>
          <p className="text-[22px] font-bold text-slate-900 tabular leading-none mt-1">
            {totalPeople.toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Reached</p>
          <p className="text-[22px] font-bold text-slate-900 tabular leading-none mt-1">{reachedPct}%</p>
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-2">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${reachedPct}%` }} />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Support rate</p>
          <p className="text-[22px] font-bold text-slate-900 tabular leading-none mt-1">{supportRate}%</p>
          {supportDelta !== null && (
            <p
              className="text-[10px] mt-1 font-medium"
              style={{
                color: supportDelta > 0 ? "#16a34a" : supportDelta < 0 ? "#dc2626" : "#94a3b8",
              }}
            >
              {supportDelta > 0 ? "+" : ""}{supportDelta} vs last week
            </p>
          )}
        </div>
      </div>

      {/* Support trend */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <LineSparkline data={supportRateSeries} height={72} yLabel="Support % · 7-day trend" ySuffix="%" />
      </div>

      {/* Opponents */}
      {competitorBreakdown.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Opponents</p>
          <div className="space-y-2">
            {competitorBreakdown.slice(0, 5).map((comp, i) => {
              const maxCount = competitorBreakdown[0].count;
              const pct = maxCount > 0 ? Math.round((comp.count / maxCount) * 100) : 0;
              return (
                <div key={comp.name}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-600">{comp.name}</span>
                    <span className="text-xs font-semibold text-red-500 tabular">{comp.count}</span>
                  </div>
                  <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400 transition-all"
                      style={{ width: `${pct}%`, opacity: i === 0 ? 1 : 0.6 }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-slate-400 mt-1">
              {competitorBreakdown.reduce((s, c) => s + c.count, 0).toLocaleString()} total for opponents
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
