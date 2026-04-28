import Link from "next/link";
import { db } from "@/lib/db";
import { getFinanceLeadDashData, getFinanceDashboardData } from "@/lib/dashboard";
import { LineSparkline } from "@/components/dashboard/sparkline-charts";

interface Props {
  campaignId: string;
  firstName: string;
}

export async function FinanceLeadDashboard({ campaignId }: Props) {
  const [finData, legacyData] = await Promise.all([
    getFinanceLeadDashData(campaignId),
    getFinanceDashboardData(campaignId),
  ]);

  const {
    interested, pledged, received, fundraisingGoal,
    topDonorsNeedingAction, donorsSeries,
  } = finData;

  const { amountByStatus, thankYouUnsentCount } = legacyData;

  const totalAmountRaised = (amountByStatus["received"] ?? 0) + (amountByStatus["pledged"] ?? 0);
  const thankYouSentCount = received - thankYouUnsentCount;

  const goalPct = fundraisingGoal && fundraisingGoal > 0
    ? Math.min(100, Math.round((totalAmountRaised / fundraisingGoal) * 100))
    : null;

  const electionDate: Date | null = null; // finance lead doesn't need election countdown

  const DONOR_STATUS_STYLES: Record<string, string> = {
    interested: "bg-amber-50 border-amber-200 text-amber-700",
    pledged: "bg-blue-50 border-blue-200 text-blue-700",
    received: "bg-emerald-50 border-emerald-200 text-emerald-700",
    thanked: "bg-slate-50 border-slate-200 text-slate-600",
  };

  const DONOR_STATUS_LABELS: Record<string, string> = {
    interested: "Need outreach",
    pledged: "Awaiting collection",
    received: "Need thank you",
    thanked: "Complete",
  };

  void electionDate;

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
              Fundraising overview
            </p>
            <p className="text-[28px] font-extrabold text-white leading-none mb-2">
              ${totalAmountRaised.toLocaleString("en-CA")} raised
              {goalPct !== null && (
                <span className="text-lg font-semibold text-white/50 ml-2">· {goalPct}% to goal</span>
              )}
            </p>
            {fundraisingGoal && fundraisingGoal > 0 ? (
              <p className="text-sm text-white/50">Goal: ${fundraisingGoal.toLocaleString("en-CA")}</p>
            ) : (
              <p className="text-sm text-white/40">No fundraising goal set</p>
            )}
          </div>
          {/* Right — pipeline value */}
          <div className="flex-shrink-0 text-right">
            <p className="text-[11px] text-white/40 uppercase tracking-widest mb-1">Pipeline</p>
            <p className="text-4xl font-extrabold leading-none" style={{ color: "#fbbf24" }}>
              {interested + pledged}
            </p>
            <p className="text-[11px] text-white/30 mt-1">interested + pledged</p>
            {fundraisingGoal && fundraisingGoal > 0 && (
              <>
                <div className="w-36 h-1.5 rounded-full bg-white/10 overflow-hidden ml-auto mt-2">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${goalPct ?? 0}%`,
                      background: "linear-gradient(90deg, #f97316, #ea580c)",
                    }}
                  />
                </div>
                <p className="text-[10px] text-white/30 mt-1">{goalPct ?? 0}% of goal</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: "interested", label: "Need outreach", value: interested },
          { key: "pledged", label: "Awaiting collection", value: pledged },
          { key: "received", label: "Need thank you", value: thankYouUnsentCount, highlight: thankYouUnsentCount > 0 },
          { key: "thanked", label: "Complete", value: thankYouSentCount },
        ].map(({ key, label, value, highlight }) => (
          <div key={key} className={`bg-white border rounded-xl p-3 ${
            highlight ? "border-amber-200" : "border-slate-200"
          }`}>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-[22px] font-bold tabular leading-none ${
              highlight ? "text-amber-500" : "text-slate-900"
            }`}>
              {value.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">{DONOR_STATUS_LABELS[key]}</p>
          </div>
        ))}
      </div>

      {/* ── Two panels ── */}
      <div className="grid grid-cols-12 gap-3">

        {/* Donors needing action — col-span-7 */}
        <div className="col-span-7 bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Donors needing action</p>
            <Link href="/donors" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">all donors →</Link>
          </div>
          {topDonorsNeedingAction.length === 0 ? (
            <p className="text-sm text-slate-400">No donors needing action right now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topDonorsNeedingAction.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 px-2.5 py-2 rounded-lg bg-slate-50"
                >
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
                  >
                    {d.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/donors/${d.id}`}
                      className="text-sm font-medium text-slate-800 hover:text-slate-600 truncate block"
                    >
                      {d.name}
                    </Link>
                    <p className="text-[11px] text-slate-400">
                      {d.amount ? `$${d.amount.toLocaleString("en-CA")}` : "No amount"}{" "}
                      · {d.daysSinceUpdate === 0 ? "Updated today" : `${d.daysSinceUpdate}d ago`}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                    DONOR_STATUS_STYLES[d.status as string] ?? "bg-slate-50 border-slate-200 text-slate-600"
                  }`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raised chart — col-span-5 */}
        <div className="col-span-5 bg-white border border-slate-200 rounded-xl p-3 flex flex-col">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Raised · day over day
          </p>
          <div className="flex-1">
            <LineSparkline data={donorsSeries} height={120} />
          </div>
          {fundraisingGoal && fundraisingGoal > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                <span>Goal progress</span>
                <span>${totalAmountRaised.toLocaleString()} / ${fundraisingGoal.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${goalPct ?? 0}%`,
                    background: "linear-gradient(90deg, #f97316, #ea580c)",
                  }}
                />
              </div>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <a
              href="/api/donors/export"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export donors CSV
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
