import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAllPeople, canManageVoterList } from "@/lib/permissions";
import { getVoterList, getCampaignTags } from "@/lib/people";
import { db } from "@/lib/db";
import { SupportLevelBadge } from "@/components/ui/badge";
import { TagChip } from "@/components/ui/tag-chip";
import { BackLink } from "@/components/ui/back-link";
import { EmptyState } from "@/components/ui/empty-state";
import { VoterListSearchBar } from "./search-bar";
import { ImportButton } from "./import-button";
import type { Role, SupportLevel } from "@/types";

export const metadata: Metadata = { title: "Import & Data Management" };

interface PageProps {
  searchParams: Promise<{ q?: string; street?: string; tag?: string; page?: string }>;
}

export default async function VoterImportPage({ searchParams }: PageProps) {
  const { q, street, tag, page: pageParam } = await searchParams;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewAllPeople(activeRole as Role)) redirect("/dashboard");

  const canManage = canManageVoterList(activeRole as Role);
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [{ people, total, totalPages }, allTags, campaignData, pendingReviewCount] = await Promise.all([
    getVoterList({ campaignId: activeCampaignId, q, street, tagId: tag, page }),
    getCampaignTags(activeCampaignId),
    db.campaign.findUnique({ where: { id: activeCampaignId }, select: { customFields: true } }),
    canManage
      ? db.personListMembership.count({ where: { campaignId: activeCampaignId, status: "pending_review" } })
      : Promise.resolve(0),
  ]);

  type CampaignCustomField = { id: string; label: string };
  const customFields = (campaignData?.customFields as CampaignCustomField[] | null) ?? [];

  const activeTag = allTags.find((t) => t.id === tag);
  const isFiltered = !!(q || street || tag);

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (street) params.set("street", street);
    if (tag) params.set("tag", tag);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/import/voters${qs ? `?${qs}` : ""}`;
  }

  const start = (page - 1) * 100 + 1;
  const end   = Math.min(page * 100, total);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto">
      <BackLink fallbackHref="/import" label="Back to Import & Data Management" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import & Data Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {total.toLocaleString()} total record{total !== 1 ? "s" : ""}
            {isFiltered && (
              <> &mdash; {total === 0 ? "no results" : `showing ${start}–${end}`}</>
            )}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="/api/voter-list/template"
              download
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download template
            </a>
            <Link
              href="/people/duplicates"
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Find duplicates
            </Link>
            {pendingReviewCount > 0 && (
              <Link
                href="/import/voters/review"
                className="inline-flex items-center gap-2 h-11 px-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                Review matches
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {pendingReviewCount}
                </span>
              </Link>
            )}
            <ImportButton customFields={customFields} />
          </div>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <VoterListSearchBar defaultQ={q ?? ""} defaultStreet={street ?? ""} />
      </div>

      {/* Active tag filter pill */}
      {activeTag && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-slate-500">Filtered by tag:</span>
          <TagChip name={activeTag.name} color={activeTag.color} />
          <Link href="/import/voters" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
            Clear
          </Link>
        </div>
      )}

      {/* Tag filter bar */}
      {!tag && allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {allTags.map((t) => (
            <Link key={t.id} href={`/import/voters?tag=${t.id}`} className="hover:opacity-80 transition-opacity">
              <TagChip name={t.name} color={t.color} />
            </Link>
          ))}
        </div>
      )}

      {/* Empty state */}
      {people.length === 0 ? (
        <EmptyState
          title={isFiltered ? "No results" : "No records yet"}
          description={
            isFiltered
              ? "Try a different name or clear the filters."
              : canManage
              ? "Import a CSV file to add voter records to this campaign."
              : "Voter records will appear here once data is imported."
          }
          action={canManage && !isFiltered ? <ImportButton customFields={customFields} /> : undefined}
        />
      ) : (
        <>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Address</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Contact</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Tags</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {people.map((person) => {
                    const addr = person.household?.address;
                    const addressLine = addr
                      ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
                      : null;
                    const cityLine = addr ? `${addr.city}` : null;
                    const latestResponse = person.canvassResponses[0];

                    return (
                      <tr key={person.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3">
                          <Link
                            href={`/people/${person.id}`}
                            className="font-medium text-slate-900 hover:text-brand-600 transition-colors"
                          >
                            {person.lastName}, {person.firstName}
                          </Link>
                          {person.birthDate && (
                            <p className="text-xs text-slate-400 mt-0.5">b. {new Date(person.birthDate).getFullYear()}</p>
                          )}
                        </td>
                        <td className="px-5 py-3 hidden sm:table-cell">
                          {addressLine ? (
                            <div>
                              <p className="text-slate-700">{addressLine}</p>
                              <p className="text-xs text-slate-400">{cityLine}</p>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs">No address</span>
                          )}
                        </td>
                        <td className="px-5 py-3 hidden lg:table-cell">
                          {person.phoneHome && <p className="text-slate-600 text-xs">{person.phoneHome}</p>}
                          {person.phoneMobile && <p className="text-slate-600 text-xs">{person.phoneMobile}</p>}
                          {person.email && <p className="text-slate-500 text-xs">{person.email}</p>}
                          {!person.phoneHome && !person.phoneMobile && !person.email && (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {person.tags.slice(0, 3).map(({ tag: t }) => (
                              <TagChip key={t.id} name={t.name} color={t.color} />
                            ))}
                            {person.tags.length > 3 && (
                              <span className="text-xs text-slate-400">+{person.tags.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {latestResponse?.supportLevel ? (
                            <SupportLevelBadge level={latestResponse.supportLevel as SupportLevel} />
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link href={pageUrl(page - 1)} className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center transition-colors">
                    Previous
                  </Link>
                ) : (
                  <span className="h-9 px-4 rounded-xl border border-slate-100 text-sm font-medium text-slate-300 inline-flex items-center cursor-not-allowed">
                    Previous
                  </span>
                )}
                <span className="text-sm text-slate-500 px-2">Page {page} of {totalPages}</span>
                {page < totalPages ? (
                  <Link href={pageUrl(page + 1)} className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center transition-colors">
                    Next
                  </Link>
                ) : (
                  <span className="h-9 px-4 rounded-xl border border-slate-100 text-sm font-medium text-slate-300 inline-flex items-center cursor-not-allowed">
                    Next
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
