import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewReports, canViewDonors } from "@/lib/permissions";
import { isDonorTrackingEnabled } from "@/lib/plan-limits";
import { UpgradeCard } from "@/components/upgrade-card";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Donor Summary" };

export default async function DonorSummaryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  const role = activeRole as Role | undefined;
  if (!role || (!canViewReports(role) && !canViewDonors(role))) redirect("/dashboard");

  const campaignId = activeCampaignId;

  const donorEnabled = await isDonorTrackingEnabled(campaignId);
  if (!donorEnabled) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Donor Summary</h1>
        </div>
        <UpgradeCard
          featureName="Donor Tracking"
          featureDescription="Track donor prospects, pledges, and receipts to manage your campaign finance pipeline."
          requiredPlan="chair"
          campaignId={campaignId}
        />
      </div>
    );
  }

  const donors = await db.donor.findMany({
    where: { campaignId, deletedAt: null },
    select: {
      id: true,
      status: true,
      amount: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneMobile: true,
      phoneHome: true,
    },
    orderBy: [{ status: "asc" }, { lastName: "asc" }],
  });

  const total = donors.length;
  const interested = donors.filter((d) => d.status === "interested").length;
  const pledged = donors.filter((d) => d.status === "pledged").length;
  const received = donors.filter((d) => d.status === "received").length;

  const totalPledged = donors
    .filter((d) => d.status === "pledged" || d.status === "received")
    .reduce((sum, d) => sum + Number(d.amount ?? 0), 0);
  const totalReceived = donors
    .filter((d) => d.status === "received")
    .reduce((sum, d) => sum + Number(d.amount ?? 0), 0);

  const fmt = (n: number) =>
    n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 });

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Donor Summary</h1>
        <p className="text-slate-500 text-sm mt-0.5">Donor prospects, pledges, and receipts</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total donors" value={total.toLocaleString()} />
        <StatCard label="Interested" value={interested.toLocaleString()} />
        <StatCard label="Pledged / received" value={(pledged + received).toLocaleString()} />
        <StatCard
          variant="hero"
          label="Amount received"
          value={fmt(totalReceived)}
          sub={`${fmt(totalPledged)} pledged`}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Donor list</h2>
        </div>
        {donors.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No donor records yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {donors.map((d) => (
                <tr key={d.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{d.firstName} {d.lastName}</p>
                    {(d.email ?? d.phoneMobile ?? d.phoneHome) && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {d.email ?? d.phoneMobile ?? d.phoneHome}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-5 py-3 text-right text-slate-700 tabular-nums hidden sm:table-cell">
                    {d.amount != null ? fmt(Number(d.amount)) : "—"}
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    interested: "bg-amber-50 text-amber-700 border-amber-200",
    pledged:    "bg-blue-50 text-blue-700 border-blue-200",
    received:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  const label: Record<string, string> = {
    interested: "Interested",
    pledged:    "Pledged",
    received:   "Received",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
      {label[status] ?? status}
    </span>
  );
}
