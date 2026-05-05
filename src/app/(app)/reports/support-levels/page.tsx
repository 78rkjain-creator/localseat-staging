import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import { SUPPORT_LEVEL_LABELS } from "@/types";
import type { Role, SupportLevel } from "@/types";

export const metadata: Metadata = { title: "Support Levels Report" };

const LEVEL_ORDER: SupportLevel[] = [
  "strong_yes", "soft_yes", "undecided", "soft_no", "strong_no", "not_home",
];

const LEVEL_COLORS: Record<SupportLevel, string> = {
  strong_yes: "bg-emerald-500",
  soft_yes:   "bg-emerald-300",
  undecided:  "bg-amber-400",
  soft_no:    "bg-red-300",
  strong_no:  "bg-red-500",
  not_home:   "bg-slate-300",
};

function pct(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

export default async function SupportLevelsReportPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewReports(activeRole as Role)) redirect("/dashboard");

  const campaignId = activeCampaignId;

  const [grouped, totalPeople] = await Promise.all([
    db.person.groupBy({
      by: ["supportLevel"],
      where: { campaignId, deletedAt: null, anonymizedAt: null },
      _count: { supportLevel: true },
    }),
    db.person.count({
      where: { campaignId, deletedAt: null, anonymizedAt: null },
    }),
  ]);

  const countMap = new Map<string | null, number>();
  for (const row of grouped) {
    countMap.set(row.supportLevel, row._count.supportLevel);
  }

  const notSetCount = countMap.get(null) ?? 0;
  const setCount = totalPeople - notSetCount;

  const rows = LEVEL_ORDER.map((level) => ({
    level,
    label: SUPPORT_LEVEL_LABELS[level] ?? level,
    count: countMap.get(level) ?? 0,
    color: LEVEL_COLORS[level],
  }));

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Support Levels</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Based on the support level recorded on each person record
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total people" value={totalPeople.toLocaleString()} />
        <StatCard
          variant="hero"
          label="Support level set"
          value={setCount.toLocaleString()}
          sub={pct(setCount, totalPeople)}
        />
        <StatCard label="No support level" value={notSetCount.toLocaleString()} sub={pct(notSetCount, totalPeople)} />
      </div>

      {/* Stacked bar */}
      {totalPeople > 0 && (
        <div className="h-3 rounded-full overflow-hidden flex bg-slate-100 mb-8">
          {rows.filter((r) => r.count > 0).map((r) => (
            <div
              key={r.level}
              className={r.color}
              style={{ width: `${(r.count / totalPeople) * 100}%` }}
              title={`${r.label}: ${r.count}`}
            />
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Breakdown by level</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Level</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">People</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">%</th>
              <th className="px-5 py-3 hidden sm:table-cell" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r) => (
              <tr key={r.level}>
                <td className="px-5 py-3 font-medium text-slate-700">{r.label}</td>
                <td className="px-5 py-3 text-right text-slate-900 tabular-nums font-semibold">
                  {r.count.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right text-slate-400 tabular-nums hidden sm:table-cell">
                  {pct(r.count, totalPeople)}
                </td>
                <td className="pr-5 py-3 w-32 hidden sm:table-cell">
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${r.color}`}
                      style={{ width: totalPeople > 0 ? `${Math.round((r.count / totalPeople) * 100)}%` : "0%" }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50/50">
              <td className="px-5 py-3 text-slate-400 italic">Not set</td>
              <td className="px-5 py-3 text-right text-slate-500 tabular-nums">
                {notSetCount.toLocaleString()}
              </td>
              <td className="px-5 py-3 text-right text-slate-400 tabular-nums hidden sm:table-cell">
                {pct(notSetCount, totalPeople)}
              </td>
              <td className="pr-5 py-3 w-32 hidden sm:table-cell">
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-200 transition-all"
                    style={{ width: totalPeople > 0 ? `${Math.round((notSetCount / totalPeople) * 100)}%` : "0%" }}
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
