import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageSuppliers } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/empty-state";
import { InviteSupplierModal } from "./invite-supplier-modal";
import { RevokeRestoreButton } from "./revoke-restore-button";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Data Suppliers" };

function fmt(date: Date): string {
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default async function DataSuppliersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canManageSuppliers(activeRole as Role)) redirect("/dashboard");

  const suppliers = await db.campaignMembership.findMany({
    where: { campaignId: activeCampaignId, role: "data_supplier" },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Load upload stats for each supplier
  const supplierIds = suppliers.map((s) => s.user.id);
  const importStats = await db.dataImport.groupBy({
    by: ["uploadedById"],
    where: {
      campaignId: activeCampaignId,
      uploadedById: { in: supplierIds },
      status: { in: ["completed", "approved"] },
    },
    _count: { id: true },
    _sum: { recordCount: true },
  });

  const statsByUser = new Map(
    importStats.map((s) => [
      s.uploadedById,
      { uploads: s._count.id, records: s._sum.recordCount ?? 0 },
    ])
  );

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Data suppliers</h1>
          <p className="text-sm text-slate-500 mt-1">
            Invite vendors to upload voter data into your campaign
          </p>
        </div>
        <InviteSupplierModal
          sessionFirstName={session.user.firstName}
          sessionLastName={session.user.lastName}
          sessionEmail={session.user.email}
        />
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <EmptyState
            title="No suppliers invited"
            description="Invite a data vendor to upload voter list data into your campaign."
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {suppliers.map((s) => {
              const stats = statsByUser.get(s.user.id);
              const isActive = !s.deletedAt;
              return (
                <div key={s.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold text-slate-900">
                        {s.company ?? s.user.firstName}
                      </p>
                      <span
                        className={[
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                          isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500",
                        ].join(" ")}
                      >
                        {isActive ? "Active" : "Revoked"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {s.user.firstName} {s.user.lastName}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap mt-1">
                      <span className="text-xs text-slate-400">{s.companyEmail ?? s.user.email}</span>
                      {s.companyPhone && (
                        <span className="text-xs text-slate-400">{s.companyPhone}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-slate-400">Invited {fmt(s.createdAt)}</span>
                      {stats && (
                        <>
                          <span className="text-xs text-slate-500">
                            {stats.uploads} {stats.uploads === 1 ? "upload" : "uploads"}
                          </span>
                          <span className="text-xs text-slate-500">
                            {stats.records.toLocaleString()} records uploaded
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <RevokeRestoreButton membershipId={s.id} isActive={isActive} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
