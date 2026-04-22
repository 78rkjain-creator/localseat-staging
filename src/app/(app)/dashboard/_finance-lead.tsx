import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getFinanceDashboardData } from "@/lib/dashboard";
import type { DonorStatus } from "@/types";
import { ROLE_LABELS, DONOR_STATUS_LABELS } from "@/types";

interface Props {
  campaignId: string;
  firstName: string;
}

export async function FinanceLeadDashboard({ campaignId, firstName }: Props) {
  const data = await getFinanceDashboardData(campaignId);
  const { countByStatus, amountByStatus, thankYouUnsentCount, recentDonors, totalDonors } = data;

  const totalAmount = Object.values(amountByStatus).reduce((a, b) => a + b, 0);

  const statusColors: Record<DonorStatus, string> = {
    interested: "text-amber-600",
    pledged: "text-blue-600",
    received: "text-emerald-600",
  };

  const statusBg: Record<DonorStatus, string> = {
    interested: "bg-amber-50 border-amber-200",
    pledged: "bg-blue-50 border-blue-200",
    received: "bg-emerald-50 border-emerald-200",
  };

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Good to see you, {firstName}</h1>
        <p className="text-slate-500 mt-1">{ROLE_LABELS["finance_lead"]}</p>
      </div>

      {/* Pipeline cards */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Donor pipeline</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {(["interested", "pledged", "received"] as DonorStatus[]).map((s) => (
          <Card key={s} padding="md" className={`border ${statusBg[s]}`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              {DONOR_STATUS_LABELS[s]}
            </p>
            <p className={`text-3xl font-bold ${statusColors[s]}`}>
              {countByStatus[s] ?? 0}
            </p>
            {amountByStatus[s] !== undefined && amountByStatus[s] > 0 && (
              <p className="text-sm text-slate-500 mt-1">
                ${amountByStatus[s].toLocaleString("en-CA", { minimumFractionDigits: 2 })}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total donors" value={totalDonors} />
        <Card padding="md">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total amounts</p>
          <p className="text-2xl font-bold text-slate-900">
            ${totalAmount.toLocaleString("en-CA", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Pledged + received</p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Thank you needed</p>
          <p className={`text-3xl font-bold ${thankYouUnsentCount > 0 ? "text-amber-500" : "text-slate-900"}`}>
            {thankYouUnsentCount}
          </p>
          {thankYouUnsentCount > 0 && (
            <p className="text-[11px] text-slate-400 mt-0.5">Received, not yet thanked</p>
          )}
        </Card>
        <Card padding="md" className="flex flex-col justify-between">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Export</p>
          <a
            href="/api/donors/export"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900"
          >
            Download CSV
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </Card>
      </div>

      {/* Recent donors */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Recent donors</h2>
          <Link href="/donors" className="text-xs font-medium text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900">View all →</Link>
        </div>

        {recentDonors.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-slate-400">No donors recorded yet.</p>
          </Card>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentDonors.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <Link href={`/donors/${d.id}`} className="font-medium text-slate-900 hover:text-slate-600">
                        {d.firstName} {d.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBg[d.status as DonorStatus]} ${statusColors[d.status as DonorStatus]}`}>
                        {DONOR_STATUS_LABELS[d.status as DonorStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {d.amount ? `$${Number(d.amount).toLocaleString("en-CA", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">
                      {new Date(d.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card padding="md">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{value.toLocaleString()}</p>
    </Card>
  );
}
