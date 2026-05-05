import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { db } from "@/lib/db";
import { DemoHint } from "@/components/demo/demo-hint";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Canvassing Activity" };

interface DailyStat {
  day: string;
  doors: number;
  responses: number;
}

interface CanvasserRow {
  name: string;
  doors: number;
  responses: number;
}

interface Summary {
  total_doors: number;
  total_responses: number;
  active_days: number;
}

function pct(n: number, d: number) {
  if (d === 0) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

export default async function CanvassingActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewReports(activeRole as Role)) redirect("/dashboard");

  const campaignId = activeCampaignId;

  const [summaryRows, canvasserRows, dailyRows] = await Promise.all([
    db.$queryRaw<[Summary]>`
      SELECT
        COUNT(DISTINCT cr."personId")::int AS total_doors,
        COUNT(*)::int                      AS total_responses,
        COUNT(DISTINCT DATE(cr."respondedAt"))::int AS active_days
      FROM canvass_responses cr
      JOIN canvass_assignments ca ON cr."assignmentId" = ca.id
      JOIN canvass_lists cl       ON ca."canvassListId" = cl.id
      WHERE cl."campaignId" = ${campaignId}
    `,

    db.$queryRaw<CanvasserRow[]>`
      SELECT
        CONCAT(u."firstName", ' ', u."lastName") AS name,
        COUNT(DISTINCT cr."personId")::int        AS doors,
        COUNT(*)::int                             AS responses
      FROM canvass_responses cr
      JOIN canvass_assignments ca ON cr."assignmentId" = ca.id
      JOIN canvass_lists cl       ON ca."canvassListId" = cl.id
      JOIN users u                ON ca."canvasserId"   = u.id
      WHERE cl."campaignId" = ${campaignId}
      GROUP BY u.id, u."firstName", u."lastName"
      ORDER BY doors DESC
    `,

    db.$queryRaw<DailyStat[]>`
      SELECT
        TO_CHAR(DATE(cr."respondedAt"), 'Mon DD') AS day,
        COUNT(DISTINCT cr."personId")::int         AS doors,
        COUNT(*)::int                              AS responses
      FROM canvass_responses cr
      JOIN canvass_assignments ca ON cr."assignmentId" = ca.id
      JOIN canvass_lists cl       ON ca."canvassListId" = cl.id
      WHERE cl."campaignId" = ${campaignId}
        AND cr."respondedAt" >= NOW() - INTERVAL '14 days'
      GROUP BY DATE(cr."respondedAt")
      ORDER BY DATE(cr."respondedAt") ASC
    `,
  ]);

  const summary = summaryRows[0];
  const totalDoors = summary?.total_doors ?? 0;
  const totalResponses = summary?.total_responses ?? 0;
  const activeDays = summary?.active_days ?? 0;
  const avgPerDay = activeDays > 0 ? (totalDoors / activeDays).toFixed(1) : "0";

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <DemoHint
        demoMode={process.env.DEMO_MODE === "true"}
        storageKey="demo-hint-report-canvassing"
        hint="This report reflects all door-knocking activity across the demo campaign. Data is updated in real time as canvassers submit responses."
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Canvassing Activity</h1>
        <p className="text-slate-500 text-sm mt-0.5">Doors knocked and canvass responses across all canvassers</p>
      </div>

      {/* Dark summary strip */}
      <div className="bg-slate-800 rounded-2xl px-6 py-4 mb-8 flex items-center justify-between flex-wrap gap-y-4">
        {[
          { label: "Total doors",     value: totalDoors.toLocaleString() },
          { label: "Total responses", value: totalResponses.toLocaleString() },
          { label: "Active days",     value: activeDays.toLocaleString() },
          { label: "Avg doors/day",   value: avgPerDay },
        ].map((s) => (
          <div key={s.label}>
            <p className="text-[11px] uppercase tracking-wide text-white/50">{s.label}</p>
            <p className="text-xl font-semibold text-white tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Last 14 days */}
      {dailyRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Last 14 days</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Doors</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Responses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {dailyRows.map((row) => (
                <tr key={row.day}>
                  <td className="px-5 py-3 font-medium text-slate-700">{row.day}</td>
                  <td className="px-5 py-3 text-right text-slate-900 tabular-nums font-semibold">{row.doors.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-slate-400 tabular-nums hidden sm:table-cell">{row.responses.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-canvasser breakdown */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">By canvasser</h2>
        </div>
        {canvasserRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No canvassing activity recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Canvasser</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Doors</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Responses</th>
                <th className="px-5 py-3 hidden sm:table-cell w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {canvasserRows.map((row) => (
                <tr key={row.name}>
                  <td className="px-5 py-3 font-medium text-slate-700">{row.name}</td>
                  <td className="px-5 py-3 text-right text-slate-900 tabular-nums font-semibold">{row.doors.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-slate-400 tabular-nums hidden sm:table-cell">{row.responses.toLocaleString()}</td>
                  <td className="pr-5 py-3 w-32 hidden sm:table-cell">
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-400"
                        style={{ width: pct(row.doors, totalDoors) }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
