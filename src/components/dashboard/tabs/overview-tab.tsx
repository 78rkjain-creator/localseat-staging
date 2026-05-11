import Link from "next/link";
import { KpiCardWithSparkline, ActionQueueItem } from "@/components/dashboard/dashboard-shared";
import { LineSparkline } from "@/components/dashboard/sparkline-charts";
import type { SeriesPoint } from "@/components/dashboard/sparkline-charts";

interface NeedsYouItem {
  id: string;
  label: string;
  count: number;
  priority: string;
  href: string;
}

interface OverviewTabProps {
  doorsToday: number;
  doorsDelta: number;
  doorsBadge: string;
  doorsSeries: SeriesPoint[];
  supportRate: number;
  supportRateSeries: SeriesPoint[];
  signsOut: number;
  signsWeek: number;
  signsSeries: SeriesPoint[];
  totalRaised: number;
  raisedWeek: number;
  donorsSeries: SeriesPoint[];
  isStarterPlan: boolean;
  forUs: number;
  undecided: number;
  againstUs: number;
  notHome: number;
  uncontacted: number;
  totalPeople: number;
  needsYou: NeedsYouItem[];
}

function BarMeter({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-[11px] text-slate-500 flex-1 min-w-0 truncate">{label}</span>
        <span className="text-[11px] font-semibold text-slate-700 tabular-nums flex-shrink-0">
          {value.toLocaleString()}
        </span>
      </div>
      <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function OverviewTab({
  doorsToday,
  doorsDelta,
  doorsBadge,
  doorsSeries,
  supportRate,
  supportRateSeries,
  signsOut,
  signsWeek,
  signsSeries,
  totalRaised,
  raisedWeek,
  donorsSeries,
  isStarterPlan,
  forUs,
  undecided,
  againstUs,
  notHome,
  uncontacted,
  totalPeople,
  needsYou,
}: OverviewTabProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* KPI strip */}
      <div className="bg-gradient-to-b from-orange-50/30 to-transparent rounded-2xl px-1 pt-1 pb-0 -mx-1">
        <div className={`grid gap-3 ${isStarterPlan ? "grid-cols-3" : "grid-cols-4"}`}>
          <KpiCardWithSparkline
            label="Doors today"
            value={doorsToday}
            badge={doorsBadge}
            badgeColor={doorsDelta >= 0 ? "green" : "amber"}
            accent
            sparkType="bar"
            sparkData={doorsSeries}
          />
          <KpiCardWithSparkline
            label="Support %"
            value={`${supportRate}%`}
            badge={`${supportRate}% of ID'd voters`}
            sparkType="line"
            sparkData={supportRateSeries}
            ySuffix="%"
          />
          <KpiCardWithSparkline
            label="Signs out"
            value={signsOut}
            badge={`+${signsWeek} this week`}
            badgeColor={signsWeek > 0 ? "green" : "amber"}
            sparkType="bar"
            sparkData={signsSeries}
          />
          {!isStarterPlan && (
            <KpiCardWithSparkline
              label="Donors"
              value={totalRaised}
              badge={`+${raisedWeek} received`}
              badgeColor={raisedWeek > 0 ? "green" : "amber"}
              sparkType="line"
              sparkData={donorsSeries}
              sparkColor="#3b82f6"
            />
          )}
        </div>
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Top-left: Voter ID mix */}
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Voter ID mix
            </p>
            <Link
              href="/people/residents"
              className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              details →
            </Link>
          </div>
          <div className="space-y-1">
            {[
              { label: "For us", value: forUs, color: "#10b981" },
              { label: "Undecided", value: undecided, color: "#f59e0b" },
              { label: "Against", value: againstUs, color: "#ef4444" },
              { label: "Not home", value: notHome, color: "#cbd5e1" },
              { label: "Not contacted", value: uncontacted, color: "#f1f5f9" },
            ].map(({ label, value, color }) => (
              <BarMeter key={label} label={label} value={value} max={totalPeople} color={color} />
            ))}
          </div>
        </div>

        {/* Top-right: Action queue */}
        <div className="px-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              For you
            </p>
            <Link
              href="/follow-ups"
              className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              queue →
            </Link>
          </div>
          {needsYou.length === 0 ? (
            <p className="text-sm text-slate-400 mt-1">All clear — nothing urgent.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {needsYou.slice(0, 4).map((item) => (
                <ActionQueueItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom-left: Support trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <LineSparkline data={supportRateSeries} height={56} yLabel="Support % · 7-day trend" ySuffix="%" />
        </div>

        {/* Bottom-right: Doors trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <LineSparkline data={doorsSeries} height={56} yLabel="Doors · 7-day trend" />
        </div>
      </div>
    </div>
  );
}
