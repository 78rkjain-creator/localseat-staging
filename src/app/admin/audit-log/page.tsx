import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { AuditLogTable } from "@/components/audit-log/audit-log-table";
import { AuditFilterBar } from "./audit-filter-bar";

const PAGE_SIZE = 50;

async function getAuditLogs(page: number, userId?: string, campaignId?: string) {
  const where = {
    ...(userId    ? { userId }    : {}),
    ...(campaignId ? { campaignId } : {}),
  };

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        user:     { select: { firstName: true, lastName: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
  ]);

  return { logs, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

async function getFilterOptions() {
  const [userRows, campaignRows] = await Promise.all([
    db.auditLog.findMany({
      where:    { userId: { not: null } },
      select:   { userId: true, user: { select: { firstName: true, lastName: true } } },
      distinct: ["userId"],
      orderBy:  { createdAt: "desc" },
      take:     500,
    }),
    db.auditLog.findMany({
      where:    { campaignId: { not: null } },
      select:   { campaignId: true, campaign: { select: { name: true } } },
      distinct: ["campaignId"],
      take:     500,
    }),
  ]);

  return {
    users: userRows
      .filter((r) => r.userId && r.user)
      .map((r) => ({ id: r.userId!, label: `${r.user!.firstName} ${r.user!.lastName}` })),
    campaigns: campaignRows
      .filter((r) => r.campaignId && r.campaign)
      .map((r) => ({ id: r.campaignId!, label: r.campaign!.name })),
  };
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; userId?: string; campaignId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user.platformRole) redirect("/dashboard");

  const { page: pageParam, userId, campaignId } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [{ logs, total, totalPages }, filterOptions] = await Promise.all([
    getAuditLogs(page, userId, campaignId),
    getFilterOptions(),
  ]);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (userId)     params.set("userId",     userId);
    if (campaignId) params.set("campaignId", campaignId);
    return `/admin/audit-log?${params.toString()}`;
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-500">
          All recorded platform actions across every campaign. All times shown in Eastern Time (ET).
        </p>
      </div>

      <AuditFilterBar
        users={filterOptions.users}
        campaigns={filterOptions.campaigns}
        selectedUserId={userId ?? null}
        selectedCampaignId={campaignId ?? null}
      />

      <AuditLogTable entries={logs} showCampaign />

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {total.toLocaleString()} entr{total !== 1 ? "ies" : "y"}
          {(userId || campaignId) && " matching filters"}
          {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref(page + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
