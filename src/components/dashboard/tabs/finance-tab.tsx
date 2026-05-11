import Link from "next/link";
import { BarSparkline, LineSparkline } from "@/components/dashboard/sparkline-charts";
import type { SeriesPoint } from "@/components/dashboard/sparkline-charts";
import type { DonorStatus } from "@/types";
import { DONOR_STATUS_LABELS } from "@/types";

interface FinanceTabProps {
  donorCountByStatus: Record<string, number>;
  donorsSeries: SeriesPoint[];
  signsOut: number;
  signsWeek: number;
  signsSeries: SeriesPoint[];
  totalRaised: number;
  // Plan usage
  constituentUsage: { count: number; limit: number } | null;
  tagUsage: { count: number; limit: number } | null;
  showUpgradeWarning: boolean;
}

function UsageMeter({
  label,
  count,
  limit,
}: {
  label: string;
  count: number;
  limit: number;
}) {
  const pct = Math.min(100, Math.round((count / limit) * 100));
  const ratio = count / limit;
  const barColor = ratio >= 0.9 ? "#f87171" : ratio >= 0.75 ? "#fbbf24" : "#94a3b8";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-medium text-slate-700 tabular">
          {count.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

export function FinanceTab({
  donorCountByStatus,
  donorsSeries,
  signsOut,
  signsWeek,
  signsSeries,
  totalRaised,
  constituentUsage,
  tagUsage,
  showUpgradeWarning,
}: FinanceTabProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Donor pipeline */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Donor pipeline
          </p>
          <Link
            href="/donors"
            className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
          >
            all donors →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {(["interested", "pledged", "received"] as DonorStatus[]).map((s) => {
            const count = donorCountByStatus[s] ?? 0;
            const styles: Record<DonorStatus, string> = {
              interested: "bg-amber-50 border-amber-200 text-amber-700",
              pledged: "bg-blue-50 border-blue-200 text-blue-700",
              received: "bg-emerald-50 border-emerald-200 text-emerald-700",
            };
            return (
              <div key={s} className={`rounded-lg border p-2.5 ${styles[s]}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-1">
                  {DONOR_STATUS_LABELS[s]}
                </p>
                <p className="text-xl font-bold tabular">{count}</p>
              </div>
            );
          })}
        </div>
        <LineSparkline data={donorsSeries} color="#3b82f6" height={56} yLabel="Donors received · 7-day trend" />
      </div>

      {/* Signs */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Signs</p>
        <div className="flex items-baseline gap-3 mb-3">
          <p className="text-2xl font-bold text-slate-900 tabular leading-none">
            {signsOut.toLocaleString()}
          </p>
          <span
            className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
              signsWeek > 0 ? "bg-[#dcfce7] text-[#16a34a]" : "bg-amber-50 text-amber-700"
            }`}
          >
            +{signsWeek} this week
          </span>
        </div>
        <BarSparkline data={signsSeries} height={52} />
      </div>

      {/* Plan usage */}
      {(constituentUsage || tagUsage) && (
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Plan usage
          </p>
          <div className="space-y-3">
            {constituentUsage && (
              <UsageMeter label="Records" count={constituentUsage.count} limit={constituentUsage.limit} />
            )}
            {tagUsage && (
              <UsageMeter label="Tags" count={tagUsage.count} limit={tagUsage.limit} />
            )}
          </div>
          {showUpgradeWarning && (
            <Link
              href="/onboarding/choose-plan"
              className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-amber-600 hover:text-amber-500 transition-colors"
            >
              <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              Upgrade plan
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
