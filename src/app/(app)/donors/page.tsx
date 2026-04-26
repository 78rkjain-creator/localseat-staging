import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewDonors, canViewDonorAmounts, isReadOnly } from "@/lib/permissions";
import { getDonors } from "@/lib/donors";
import { Card } from "@/components/ui/card";
import { AddDonorModal } from "./add-donor-modal";
import type { Role, DonorStatus } from "@/types";
import { DONOR_STATUS_LABELS } from "@/types";

export const metadata: Metadata = { title: "Donors" };

interface PageProps {
  searchParams: Promise<{ status?: string; thankYou?: string; page?: string }>;
}

export default async function DonorsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewDonors(activeRole as Role)) redirect("/dashboard");

  const params = await searchParams;
  const status = (params.status as DonorStatus | "") || "";
  const thankYouFilter = (params.thankYou as "yes" | "no" | "") || "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const showAmounts = canViewDonorAmounts(activeRole as Role);
  const readOnly = isReadOnly(activeRole as Role);

  const { donors, total, totalPages } = await getDonors({
    campaignId: activeCampaignId,
    status: status || undefined,
    thankYouSent: thankYouFilter || undefined,
    page,
  });

  const statusOptions: { value: DonorStatus | ""; label: string }[] = [
    { value: "", label: "All statuses" },
    { value: "interested", label: "Interested" },
    { value: "pledged", label: "Pledged" },
    { value: "received", label: "Received" },
  ];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Donors</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} total</p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-3">
            <a
              href="/api/donors/export"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Export CSV
            </a>
            <AddDonorModal />
          </div>
        )}
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6">
        <select
          name="status"
          defaultValue={status}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          name="thankYou"
          defaultValue={thankYouFilter}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Thank you: all</option>
          <option value="yes">Thank you sent</option>
          <option value="no">Thank you not sent</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Filter
        </button>
        {(status || thankYouFilter) && (
          <a
            href="/donors"
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Clear
          </a>
        )}
      </form>

      {/* Table */}
      {donors.length === 0 ? (
        <Card padding="md">
          <p className="text-sm text-slate-400 text-center py-8">
            No donors found.{" "}
            {!status && !thankYouFilter && "Use the canvassing screen to flag donor interest, or add a donor manually."}
          </p>
        </Card>
      ) : (
        <Card className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Status
                  </th>
                  {showAmounts && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Amount
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                    Contact
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Thank You
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {donors.map((donor) => (
                  <tr key={donor.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/donors/${donor.id}`}
                        className="font-medium text-slate-900 hover:text-slate-600"
                      >
                        {donor.firstName} {donor.lastName}
                      </Link>
                      {donor.linkedPerson && (
                        <Link
                          href={`/people/${donor.linkedPerson.id}`}
                          className="block text-xs text-slate-400 hover:text-slate-600 mt-0.5"
                        >
                          View voter record
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={donor.status as DonorStatus} />
                    </td>
                    {showAmounts && (
                      <td className="px-4 py-3 text-slate-700">
                        {donor.amount ? `$${Number(donor.amount).toLocaleString("en-CA", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      {donor.email || donor.phoneHome || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {donor.thankYouSent ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Sent
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Not sent</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/donors/${donor.id}`}
                        className="text-slate-400 hover:text-slate-600"
                        aria-label="View donor"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <PaginationLink
                    href={buildUrl({ status, thankYou: thankYouFilter, page: page - 1 })}
                    label="Previous"
                  />
                )}
                {page < totalPages && (
                  <PaginationLink
                    href={buildUrl({ status, thankYou: thankYouFilter, page: page + 1 })}
                    label="Next"
                  />
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function buildUrl(params: { status: string; thankYou: string; page: number }) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.thankYou) qs.set("thankYou", params.thankYou);
  if (params.page > 1) qs.set("page", String(params.page));
  const str = qs.toString();
  return `/donors${str ? `?${str}` : ""}`;
}

function StatusBadge({ status }: { status: DonorStatus }) {
  const styles: Record<DonorStatus, string> = {
    interested: "bg-amber-50 text-amber-700 border-amber-200",
    pledged:    "bg-blue-50 text-blue-700 border-blue-200",
    received:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {DONOR_STATUS_LABELS[status]}
    </span>
  );
}

function PaginationLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
    >
      {label}
    </Link>
  );
}
