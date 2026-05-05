import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Touches Report" };

interface TouchBucket {
  zero: number;
  one_two: number;
  three_five: number;
  six_ten: number;
  over_ten: number;
  total: number;
  total_touches: number;
}

function pct(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

export default async function TouchesReportPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewReports(activeRole as Role)) redirect("/dashboard");

  const campaignId = activeCampaignId;

  const [result] = await db.$queryRaw<[TouchBucket]>`
    SELECT
      SUM(CASE WHEN touches = 0 THEN 1 ELSE 0 END)::int            AS zero,
      SUM(CASE WHEN touches BETWEEN 1 AND 2 THEN 1 ELSE 0 END)::int AS one_two,
      SUM(CASE WHEN touches BETWEEN 3 AND 5 THEN 1 ELSE 0 END)::int AS three_five,
      SUM(CASE WHEN touches BETWEEN 6 AND 10 THEN 1 ELSE 0 END)::int AS six_ten,
      SUM(CASE WHEN touches > 10 THEN 1 ELSE 0 END)::int            AS over_ten,
      COUNT(*)::int                                                  AS total,
      COALESCE(SUM(touches), 0)::int                                AS total_touches
    FROM (
      SELECT
        p.id,
        COALESCE(c.n, 0) + COALESCE(o.n, 0) AS touches
      FROM people p
      LEFT JOIN (
        SELECT cr."personId", COUNT(*)::int AS n
        FROM canvass_responses cr
        JOIN canvass_assignments ca ON cr."assignmentId" = ca.id
        JOIN canvass_lists cl ON ca."canvassListId" = cl.id
        WHERE cl."campaignId" = ${campaignId}
        GROUP BY cr."personId"
      ) c ON c."personId" = p.id
      LEFT JOIN (
        SELECT "personId", COUNT(*)::int AS n
        FROM outreach_logs
        WHERE "campaignId" = ${campaignId} AND "deletedAt" IS NULL
        GROUP BY "personId"
      ) o ON o."personId" = p.id
      WHERE p."campaignId" = ${campaignId}
        AND p."deletedAt" IS NULL
        AND p."anonymizedAt" IS NULL
    ) t
  `;

  const totalPeople = result.total ?? 0;
  const withTouches = totalPeople - (result.zero ?? 0);
  const avgTouches =
    withTouches > 0
      ? ((result.total_touches ?? 0) / withTouches).toFixed(1)
      : "0";

  const buckets = [
    { label: "0 touches",    count: result.zero ?? 0 },
    { label: "1–2 touches",  count: result.one_two ?? 0 },
    { label: "3–5 touches",  count: result.three_five ?? 0 },
    { label: "6–10 touches", count: result.six_ten ?? 0 },
    { label: "10+ touches",  count: result.over_ten ?? 0 },
  ];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Touches Report</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Canvass responses + outreach logs per person
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total people" value={totalPeople.toLocaleString()} />
        <StatCard
          variant="hero"
          label="Contacted (1+ touches)"
          value={withTouches.toLocaleString()}
          sub={pct(withTouches, totalPeople)}
        />
        <StatCard label="Avg touches per contacted" value={avgTouches} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Distribution</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          {buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-4">
              <span className="w-28 text-sm text-slate-600 font-medium flex-shrink-0">{b.label}</span>
              <div className="flex-1 h-6 rounded bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded bg-brand-400"
                  style={{ width: totalPeople > 0 ? `${Math.round((b.count / totalPeople) * 100)}%` : "0%" }}
                />
              </div>
              <div className="text-right tabular-nums text-sm flex-shrink-0 w-20">
                <span className="font-semibold text-slate-900">{b.count.toLocaleString()}</span>
                <span className="text-slate-400 ml-1.5 text-xs">{pct(b.count, totalPeople)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
