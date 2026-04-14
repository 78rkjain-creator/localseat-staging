import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { Role, OutreachChannel } from "@/types";
import { OUTREACH_CHANNEL_LABELS } from "@/types";
import { canManageFollowUps } from "@/lib/permissions";
import {
  getOutreachLog,
  getMyOutreachLog,
  getOutreachStaffMembers,
} from "@/lib/outreach";
import { OutreachToolbar } from "./toolbar";

export const metadata: Metadata = { title: "Outreach" };

const CHANNELS = Object.entries(OUTREACH_CHANNEL_LABELS) as [OutreachChannel, string][];

interface PageProps {
  searchParams: Promise<{
    channel?: string;
    staffId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}

export default async function OutreachPage({ searchParams }: PageProps) {
  const { channel, staffId, dateFrom, dateTo, page: pageParam } = await searchParams;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole, id: userId } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  const role = activeRole as Role;
  const isManager = canManageFollowUps(role);
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const channelFilter = (channel as OutreachChannel | undefined) || undefined;

  const [data, staffMembers] = await Promise.all([
    isManager
      ? getOutreachLog({ campaignId: activeCampaignId, channel: channelFilter, staffId, dateFrom, dateTo, page })
      : getMyOutreachLog({ campaignId: activeCampaignId, userId, channel: channelFilter, dateFrom, dateTo, page }),
    isManager ? getOutreachStaffMembers(activeCampaignId) : Promise.resolve([]),
  ]);

  const { logs, total, totalPages } = data;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Outreach log</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {total.toLocaleString()} entr{total === 1 ? "y" : "ies"}
            {isManager ? "" : " (your contacts only)"}
          </p>
        </div>
        {isManager && (
          <OutreachToolbar campaignId={activeCampaignId} />
        )}
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6">
        <select
          name="channel"
          defaultValue={channel ?? ""}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All channels</option>
          {CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        {isManager && staffMembers.length > 0 && (
          <select
            name="staffId"
            defaultValue={staffId ?? ""}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All staff</option>
            {staffMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
            ))}
          </select>
        )}

        <input
          type="date"
          name="dateFrom"
          defaultValue={dateFrom ?? ""}
          placeholder="From"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          type="date"
          name="dateTo"
          defaultValue={dateTo ?? ""}
          placeholder="To"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        <button
          type="submit"
          className="h-10 px-4 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          Filter
        </button>
        {(channel || staffId || dateFrom || dateTo) && (
          <Link
            href="/outreach"
            className="h-10 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 flex items-center transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Log entries */}
      {logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-5 py-12 text-center">
          <p className="text-sm font-medium text-slate-700 mb-1">No entries found</p>
          <p className="text-xs text-slate-400">
            {channel || staffId || dateFrom || dateTo
              ? "Try clearing your filters."
              : "Outreach activity will appear here as canvassers record contacts."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => {
            const addr = log.person.household?.address;
            const addressLine = addr
              ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}, ${addr.city}`
              : null;

            return (
              <div key={log.id} className="bg-white rounded-2xl border border-slate-100 px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="min-w-0">
                    <Link
                      href={`/people/${log.person.id}`}
                      className="text-base font-semibold text-slate-900 hover:text-brand-600 transition-colors"
                    >
                      {log.person.firstName} {log.person.lastName}
                    </Link>
                    {addressLine && (
                      <p className="text-xs text-slate-500 mt-0.5">{addressLine}</p>
                    )}
                  </div>
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-600 rounded-full px-2.5 py-1 flex-shrink-0">
                    {OUTREACH_CHANNEL_LABELS[log.channel as OutreachChannel] ?? log.channel}
                  </span>
                </div>

                {log.outcome && (
                  <p className="text-sm text-slate-700 font-medium mt-1">{log.outcome}</p>
                )}
                {log.notes && (
                  <p className="text-sm text-slate-600 mt-1 leading-snug">{log.notes}</p>
                )}

                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-slate-400">
                  <span>{new Date(log.date).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}</span>
                  {log.user && <span>{log.user.firstName} {log.user.lastName}</span>}
                  {log.phonedBy && <span>Called by {log.phonedBy}</span>}
                  {log.phoneType && <span>{log.phoneType}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={buildPageUrl({ channel, staffId, dateFrom, dateTo, page: page - 1 })}
              className="h-10 px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center transition-colors"
            >
              ← Previous
            </Link>
          )}
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildPageUrl({ channel, staffId, dateFrom, dateTo, page: page + 1 })}
              className="h-10 px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center transition-colors"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function buildPageUrl(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, String(v));
  }
  return `/outreach?${p.toString()}`;
}
