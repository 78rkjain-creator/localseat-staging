import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { isSignTrackingEnabled } from "@/lib/plan-limits";
import { UpgradeCard } from "@/components/upgrade-card";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Sign Summary" };

function pct(n: number, d: number) {
  if (d === 0) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

export default async function SignSummaryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewReports(activeRole as Role)) redirect("/dashboard");

  const campaignId = activeCampaignId;

  const signEnabled = await isSignTrackingEnabled(campaignId);
  if (!signEnabled) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Sign Summary</h1>
        </div>
        <UpgradeCard
          featureName="Sign Tracking"
          featureDescription="Track lawn sign placements, installations, and pickup requests across your campaign territory."
          requiredPlan="chair"
          campaignId={campaignId}
        />
      </div>
    );
  }

  const signs = await db.sign.findMany({
    where: { campaignId, deletedAt: null },
    select: {
      status: true,
      address: {
        select: { streetName: true, city: true },
      },
    },
  });

  const total = signs.length;
  const installed = signs.filter((s) => s.status === "installed").length;
  const pending = signs.filter((s) => s.status === "to_be_installed").length;
  const installRate = pct(installed, total);

  const streetMap = new Map<string, { total: number; installed: number; pending: number }>();
  for (const s of signs) {
    const streetName = s.address?.streetName ?? "Unknown street";
    const city = s.address?.city ?? "";
    const key = city ? `${streetName}, ${city}` : streetName;
    if (!streetMap.has(key)) streetMap.set(key, { total: 0, installed: 0, pending: 0 });
    const row = streetMap.get(key)!;
    row.total++;
    if (s.status === "installed") row.installed++;
    if (s.status === "to_be_installed") row.pending++;
  }

  const streetRows = [...streetMap.entries()]
    .map(([street, row]) => ({ street, ...row }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Sign Summary</h1>
        <p className="text-slate-500 text-sm mt-0.5">Lawn sign placements and installation status</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total signs" value={total.toLocaleString()} />
        <StatCard label="Installed" value={installed.toLocaleString()} />
        <StatCard label="Pending install" value={pending.toLocaleString()} />
        <StatCard variant="hero" label="Install rate" value={installRate} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">By street</h2>
        </div>
        {streetRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No sign requests recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Street</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Installed</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Pending</th>
                <th className="px-5 py-3 hidden sm:table-cell w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {streetRows.map((row) => (
                <tr key={row.street}>
                  <td className="px-5 py-3 font-medium text-slate-700">{row.street}</td>
                  <td className="px-5 py-3 text-right text-slate-900 tabular-nums font-semibold">{row.total}</td>
                  <td className="px-5 py-3 text-right text-emerald-600 tabular-nums hidden sm:table-cell">{row.installed}</td>
                  <td className="px-5 py-3 text-right text-amber-600 tabular-nums hidden sm:table-cell">{row.pending}</td>
                  <td className="pr-5 py-3 w-28 hidden sm:table-cell">
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: pct(row.installed, row.total) }}
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
