import { formatAuditDescription } from "@/lib/audit-descriptions";

export interface AuditEntry {
  id: string;
  action: string;
  createdAt: Date;
  after: unknown;
  userId?: string | null;
  user: { firstName: string; lastName: string } | null;
  campaign?: { name: string } | null;
}

function formatET(date: Date): string {
  return new Date(date).toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditLogTable({
  entries,
  showCampaign = false,
  emptyMessage = "No audit log entries found.",
}: {
  entries: AuditEntry[];
  showCampaign?: boolean;
  emptyMessage?: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-12 text-center text-sm text-slate-400">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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
            {showCampaign && (
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                Campaign
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {entries.map((entry) => {
            const actorName = entry.user
              ? `${entry.user.firstName} ${entry.user.lastName}`
              : "System";
            const metadata =
              entry.after && typeof entry.after === "object" && !Array.isArray(entry.after)
                ? (entry.after as Record<string, unknown>)
                : null;
            const description = formatAuditDescription(entry.action, metadata, actorName);
            const isSupportEntry = metadata?.supportAccess === true;

            return (
              <tr
                key={entry.id}
                className={`hover:bg-slate-50 transition-colors ${isSupportEntry ? "bg-amber-50/40" : ""}`}
              >
                <td className="px-5 py-3.5 text-slate-500 tabular-nums whitespace-nowrap align-top">
                  <p className="text-xs">{formatET(entry.createdAt)}</p>
                </td>
                <td className="px-5 py-3.5 align-top">
                  <div className="flex items-start gap-2">
                    <p className="text-sm text-slate-800">{description}</p>
                    {isSupportEntry && (
                      <span className="flex-shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700">
                        Support
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell align-top">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 font-mono"
                    title={entry.action}
                  >
                    {entry.action}
                  </span>
                </td>
                {showCampaign && (
                  <td className="px-5 py-3.5 hidden lg:table-cell text-slate-500 align-top">
                    {entry.campaign?.name ?? <span className="text-slate-300">—</span>}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
