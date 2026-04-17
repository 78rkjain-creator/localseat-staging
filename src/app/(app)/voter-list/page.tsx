import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAllPeople, canExportData } from "@/lib/permissions";
import {
  getPeopleList,
  getPeopleCount,
  getCampaignTags,
} from "@/lib/people";
import { SupportLevelBadge } from "@/components/ui/badge";
import { TagChip } from "@/components/ui/tag-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PeopleSearchBar } from "./search-bar";
import type { Role, SupportLevel } from "@/types";

export const metadata: Metadata = { title: "Voter List" };

interface PageProps {
  searchParams: Promise<{ q?: string; tag?: string }>;
}

export default async function VoterListPage({ searchParams }: PageProps) {
  const { q, tag } = await searchParams;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole && !canViewAllPeople(activeRole as Role)) redirect("/dashboard");

  const canExport = activeRole ? canExportData(activeRole as Role) : false;

  const [people, totalCount, allTags] = await Promise.all([
    getPeopleList({
      campaignId: activeCampaignId,
      q,
      tagId: tag,
    }),
    getPeopleCount(activeCampaignId),
    getCampaignTags(activeCampaignId),
  ]);

  const activeTagId = tag;
  const activeTag = allTags.find((t) => t.id === activeTagId);
  const isFiltered = !!q || !!activeTagId;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Voter List</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {totalCount.toLocaleString()} total
            {isFiltered && people.length < totalCount && (
              <> &mdash; showing {people.length} result{people.length !== 1 ? "s" : ""}</>
            )}
          </p>
        </div>
        {canExport && (
          <a
            href="/voter-list/export"
            download
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm flex-shrink-0"
          >
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </a>
        )}
      </div>

      {/* Search + tag filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1">
          <PeopleSearchBar defaultValue={q ?? ""} />
        </div>
      </div>

      {/* Active tag filter pill */}
      {activeTag && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-slate-500">Filtered by tag:</span>
          <TagChip name={activeTag.name} color={activeTag.color} />
          <Link
            href="/voter-list"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Clear
          </Link>
        </div>
      )}

      {/* Tag filter bar */}
      {!activeTagId && allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {allTags.map((tag) => (
            <TagChip
              key={tag.id}
              name={tag.name}
              color={tag.color}
              tagId={tag.id}
            />
          ))}
        </div>
      )}

      {/* List */}
      {people.length === 0 ? (
        <EmptyState
          title={isFiltered ? "No results" : "No people yet"}
          description={
            isFiltered
              ? "Try a different name or clear the filter."
              : "Voter records will appear here once data is imported."
          }
        />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {people.map((person) => {
              const latestResponse = person.canvassResponses[0];
              const address = person.household?.address;
              const addressLine = address
                ? `${address.streetNumber} ${address.streetName}${
                    address.unitNumber ? ` #${address.unitNumber}` : ""
                  }`
                : null;

              return (
                <li key={person.id}>
                  <Link
                    href={`/voter-list/${person.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-slate-500">
                        {person.firstName[0]}
                        {person.lastName[0]}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">
                        {person.firstName} {person.lastName}
                      </p>
                      {addressLine && (
                        <p className="text-sm text-slate-500 truncate">
                          {addressLine}
                        </p>
                      )}
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                      {person.tags.slice(0, 2).map(({ tag }) => (
                        <TagChip
                          key={tag.id}
                          name={tag.name}
                          color={tag.color}
                        />
                      ))}
                      {person.tags.length > 2 && (
                        <span className="text-xs text-slate-400">
                          +{person.tags.length - 2}
                        </span>
                      )}
                    </div>

                    <div className="flex-shrink-0 ml-2">
                      {latestResponse?.supportLevel && (
                        <SupportLevelBadge
                          level={latestResponse.supportLevel as SupportLevel}
                        />
                      )}
                    </div>

                    <svg
                      className="h-4 w-4 text-slate-300 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>

          {people.length === 50 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-sm text-slate-500 text-center">
                Showing first 50 results &mdash; use search to narrow down
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
