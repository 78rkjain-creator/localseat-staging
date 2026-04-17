import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { formatAuditDescription } from "@/lib/audit-descriptions";

const PAGE_SIZE = 50;

async function getAuditLogs(page: number) {
  const skip = (page - 1) * PAGE_SIZE;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      include: {
        user: { select: { firstName: true, lastName: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.auditLog.count(),
  ]);

  return {
    logs,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user.platformRole) redirect("/dashboard");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const { logs, total, totalPages } = await getAuditLogs(page);

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-500">
          All recorded platform actions across every campaign.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No audit log entries found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Timestamp
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Description
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                  Action
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                  Campaign
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log) => {
                const actorName = log.user
                  ? `${log.user.firstName} ${log.user.lastName}`
                  : "System";
                const metadata =
                  log.after && typeof log.after === "object" && !Array.isArray(log.after)
                    ? (log.after as Record<string, unknown>)
                    : null;
                const description = formatAuditDescription(log.action, metadata, actorName);

                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-slate-500 tabular-nums whitespace-nowrap align-top">
                      <p className="text-xs">
                        {new Date(log.createdAt).toLocaleDateString("en-CA", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(log.createdAt).toLocaleTimeString("en-CA", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 align-top">
                      <p className="text-sm text-slate-800">{description}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell align-top">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 font-mono"
                        title={log.action}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-slate-500 align-top">
                      {log.campaign?.name ?? <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {total.toLocaleString()} entr{total !== 1 ? "ies" : "y"} total
          {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={`/admin/audit-log?page=${page - 1}`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/audit-log?page=${page + 1}`}
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
