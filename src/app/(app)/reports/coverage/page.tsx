import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Geographic Coverage" };

interface StreetRow {
  street_name: string;
  city: string;
  total_addresses: number;
  canvassed_addresses: number;
}

function pct(n: number, d: number) {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

export default async function GeographicCoveragePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewReports(activeRole as Role)) redirect("/dashboard");

  const campaignId = activeCampaignId;

  const [summaryRows, streetRows] = await Promise.all([
    db.$queryRaw<[{ total_addresses: number; canvassed_addresses: number }]>`
      SELECT
        COUNT(DISTINCT a.id)::int AS total_addresses,
        COUNT(DISTINCT CASE WHEN cr.id IS NOT NULL THEN a.id END)::int AS canvassed_addresses
      FROM addresses a
      JOIN households h ON h."addressId" = a.id
      JOIN people p     ON p."householdId" = h.id AND p."campaignId" = ${campaignId} AND p."deletedAt" IS NULL
      LEFT JOIN canvass_responses cr ON cr."personId" = p.id
        AND EXISTS (
          SELECT 1 FROM canvass_assignments ca
          JOIN canvass_lists cl ON ca."canvassListId" = cl.id
          WHERE ca.id = cr."assignmentId" AND cl."campaignId" = ${campaignId}
        )
    `,

    db.$queryRaw<StreetRow[]>`
      SELECT
        a."streetName"                                                             AS street_name,
        COALESCE(a."city", '')                                                     AS city,
        COUNT(DISTINCT a.id)::int                                                  AS total_addresses,
        COUNT(DISTINCT CASE WHEN cr.id IS NOT NULL THEN a.id END)::int             AS canvassed_addresses
      FROM addresses a
      JOIN households h ON h."addressId" = a.id
      JOIN people p     ON p."householdId" = h.id AND p."campaignId" = ${campaignId} AND p."deletedAt" IS NULL
      LEFT JOIN canvass_responses cr ON cr."personId" = p.id
        AND EXISTS (
          SELECT 1 FROM canvass_assignments ca
          JOIN canvass_lists cl ON ca."canvassListId" = cl.id
          WHERE ca.id = cr."assignmentId" AND cl."campaignId" = ${campaignId}
        )
      GROUP BY a."streetName", a."city"
      ORDER BY canvassed_addresses ASC, total_addresses DESC
    `,
  ]);

  const summary = summaryRows[0];
  const totalAddresses = summary?.total_addresses ?? 0;
  const canvassedAddresses = summary?.canvassed_addresses ?? 0;
  const coveragePct = pct(canvassedAddresses, totalAddresses);
  const zeroCoverageStreets = streetRows.filter((r) => r.canvassed_addresses === 0).length;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Geographic Coverage</h1>
        <p className="text-slate-500 text-sm mt-0.5">Canvassing coverage by address and street</p>
      </div>

      {/* Hero percentage */}
      <div className="text-center mb-8">
        <p className="text-5xl font-bold text-slate-900 tabular-nums">{coveragePct}</p>
        <p className="text-sm text-slate-500 mt-2">of addresses canvassed</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total addresses" value={totalAddresses.toLocaleString()} />
        <StatCard label="Canvassed" value={canvassedAddresses.toLocaleString()} />
        <StatCard
          variant="hero"
          label="Coverage"
          value={coveragePct}
        />
        <StatCard label="Streets uncovered" value={zeroCoverageStreets.toLocaleString()} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Coverage by street</h2>
          <p className="text-xs text-slate-400 mt-0.5">Sorted worst coverage first</p>
        </div>
        {streetRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No addresses on file for this campaign.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Street</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Addresses</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Canvassed</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Coverage</th>
                <th className="px-5 py-3 hidden sm:table-cell w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {streetRows.map((row) => {
                const streetLabel = row.city ? `${row.street_name}, ${row.city}` : row.street_name;
                const coverage = pct(row.canvassed_addresses, row.total_addresses);
                const barWidth =
                  row.total_addresses > 0
                    ? `${Math.round((row.canvassed_addresses / row.total_addresses) * 100)}%`
                    : "0%";
                return (
                  <tr key={streetLabel}>
                    <td className="px-5 py-3 font-medium text-slate-700">{streetLabel}</td>
                    <td className="px-5 py-3 text-right text-slate-900 tabular-nums font-semibold">{row.total_addresses}</td>
                    <td className="px-5 py-3 text-right text-slate-500 tabular-nums hidden sm:table-cell">{row.canvassed_addresses}</td>
                    <td className="px-5 py-3 text-right text-slate-500 tabular-nums hidden sm:table-cell">{coverage}</td>
                    <td className="pr-5 py-3 w-28 hidden sm:table-cell">
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-400"
                          style={{ width: barWidth }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
