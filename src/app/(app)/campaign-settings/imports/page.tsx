import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canReviewDataImports } from "@/lib/permissions";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Data Imports" };

function fmt(date: Date): string {
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_PILLS: Record<string, string> = {
  pending:    "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  completed:  "bg-emerald-50 text-emerald-700",
  approved:   "bg-emerald-50 text-emerald-700",
  rejected:   "bg-red-50 text-red-700",
  failed:     "bg-red-50 text-red-700",
};

function StatusPill({ status }: { status: string }) {
  const classes = STATUS_PILLS[status] ?? "bg-slate-100 text-slate-500";
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${classes}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default async function DataImportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canReviewDataImports(activeRole as Role)) redirect("/dashboard");

  const allImports = await db.dataImport.findMany({
    where: { campaignId: activeCampaignId },
    include: {
      uploadedBy: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch supplier company names for the displayed imports
  const uploaderIds = [...new Set(allImports.map((i) => i.uploadedById))];
  const memberships = await db.campaignMembership.findMany({
    where: { campaignId: activeCampaignId, userId: { in: uploaderIds } },
    select: { userId: true, company: true },
  });
  const companyByUser = new Map(memberships.map((m) => [m.userId, m.company]));

  const pending = allImports.filter((i) => i.status === "pending");
  const history = allImports.filter((i) => i.status !== "pending");

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Data imports</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review and approve data uploads from suppliers
        </p>
      </div>

      {/* Pending section */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
          Pending review
        </h2>
        {pending.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <EmptyState
              title="No pending imports"
              description="Uploads from your data suppliers will appear here for review."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((imp) => {
              const company = companyByUser.get(imp.uploadedById);
              return (
                <div
                  key={imp.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{imp.fileName}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {company ? `${company} · ` : ""}
                        {imp.uploadedBy.firstName} {imp.uploadedBy.lastName}
                        {" · "}{fmt(imp.createdAt)}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        {imp.recordCount.toLocaleString()} records
                        {" "}({imp.validCount.toLocaleString()} valid
                        {imp.errorCount > 0 ? `, ${imp.errorCount.toLocaleString()} errors` : ""})
                      </p>
                      {imp.supplierNote && (
                        <p className="text-xs text-slate-400 italic mt-1">{imp.supplierNote}</p>
                      )}
                    </div>
                    <Link
                      href={`/campaign-settings/imports/${imp.id}`}
                      className="flex-shrink-0 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History section */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 mt-8">
            History
          </h2>
          <div className="flex flex-col gap-2">
            {history.map((imp) => {
              const company = companyByUser.get(imp.uploadedById);
              return (
                <div
                  key={imp.id}
                  className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-medium text-slate-900 truncate">{imp.fileName}</p>
                      <StatusPill status={imp.status} />
                    </div>
                    <p className="text-xs text-slate-400">
                      {company ? `${company} · ` : ""}
                      {imp.uploadedBy.firstName} {imp.uploadedBy.lastName}
                      {" · "}{fmt(imp.createdAt)}
                      {" · "}{imp.recordCount.toLocaleString()} records
                    </p>
                    {imp.reviewNote && imp.status === "rejected" && (
                      <p className="text-xs text-red-600 italic mt-1">{imp.reviewNote}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
