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
import { VoterListDateFilter } from "./filters-client";
import type { Role, SupportLevel } from "@/types";

export const metadata: Metadata = { title: "Residents List" };

type SupportFilter = "supporting" | "undecided" | "not_supporting" | "not_contacted";
type VotedInFilter = "municipal" | "provincial" | "federal";

const VOTED_IN_LABELS: Record<VotedInFilter, string> = {
  municipal: "Voted municipal",
  provincial: "Voted provincial",
  federal: "Voted federal",
};

const SUPPORT_FILTER_LABELS: Record<SupportFilter, string> = {
  supporting: "Supporting",
  undecided: "Undecided",
  not_supporting: "Not supporting",
  not_contacted: "Not contacted",
};

const SUPPORT_FILTER_PILLS: { label: string; value: SupportFilter | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Supporting", value: "supporting" },
  { label: "Undecided", value: "undecided" },
  { label: "Not supporting", value: "not_supporting" },
  { label: "Not contacted", value: "not_contacted" },
];

function buildUrl(params: { q?: string; tag?: string; supportFilter?: string; contactedAfter?: string; votedIn?: string }) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.tag) p.set("tag", params.tag);
  if (params.supportFilter) p.set("supportFilter", params.supportFilter);
  if (params.contactedAfter) p.set("contactedAfter", params.contactedAfter);
  if (params.votedIn) p.set("votedIn", params.votedIn);
  const s = p.toString();
  return `/voter-list${s ? `?${s}` : ""}`;
}

interface PageProps {
  searchParams: Promise<{ q?: string; tag?: string; supportFilter?: string; contactedAfter?: string; votedIn?: string }>;
}

export default async function VoterListPage({ searchParams }: PageProps) {
  const { q, tag, supportFilter: rawSupportFilter, contactedAfter, votedIn: rawVotedIn } = await searchParams;
  const supportFilter = (rawSupportFilter && rawSupportFilter in SUPPORT_FILTER_LABELS)
    ? rawSupportFilter as SupportFilter
    : undefined;
  const votedIn = (rawVotedIn && rawVotedIn in VOTED_IN_LABELS)
    ? rawVotedIn as VotedInFilter
    : undefined;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole && !canViewAllPeople(activeRole as Role)) redirect("/dashboard");

  const canExport = activeRole ? canExportData(activeRole as Role) : false;

  const canSeeVotingFilter =
    activeRole === "candidate" ||
    activeRole === "campaign_manager" ||
    activeRole === "co_chair";

  const [people, totalCount, allTags] = await Promise.all([
    getPeopleList({
      campaignId: activeCampaignId,
      q,
      tagId: tag,
      supportFilter,
      contactedAfter,
      votedIn: canSeeVotingFilter ? votedIn : undefined,
    }),
    getPeopleCount(activeCampaignId),
    getCampaignTags(activeCampaignId),
  ]);

  const activeTagId = tag;
  const activeTag = allTags.find((t) => t.id === activeTagId);
  const isFiltered = !!q || !!activeTagId || !!supportFilter || !!contactedAfter || !!votedIn;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Residents List</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {totalCount.toLocaleString()} total
            {isFiltered && people.length < totalCount && (
              <> &mdash; showing {people.length} result{people.length !== 1 ? "s" : ""}</>
            )}
            {supportFilter && (
              <> &middot; filtered by: {SUPPORT_FILTER_LABELS[supportFilter]}</>
            )}
            {contactedAfter && (
              <> &middot; contacted after {new Date(contactedAfter).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</>
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

      {/* Search */}
      <div className="mb-3">
        <PeopleSearchBar defaultValue={q ?? ""} />
      </div>

      {/* Support filter pills + date filter */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {SUPPORT_FILTER_PILLS.map((pill) => {
          const isActive = supportFilter === pill.value;
          return (
            <Link
              key={pill.label}
              href={buildUrl({ q, tag, supportFilter: pill.value, contactedAfter })}
              className={
                isActive
                  ? "bg-slate-900 text-white rounded-full px-3 py-1.5 text-xs font-semibold"
                  : "bg-white border border-slate-200 text-slate-600 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              }
            >
              {pill.label}
            </Link>
          );
        })}
        <VoterListDateFilter
          q={q}
          tag={tag}
          supportFilter={supportFilter}
          contactedAfter={contactedAfter}
        />
      </div>

      {/* Voted-in filter pills — candidate/manager only */}
      {canSeeVotingFilter && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-slate-400 font-medium">Voting history:</span>
          {(["municipal", "provincial", "federal"] as VotedInFilter[]).map((v) => (
            <Link
              key={v}
              href={buildUrl({ q, tag, supportFilter, contactedAfter, votedIn: votedIn === v ? undefined : v })}
              className={
                votedIn === v
                  ? "bg-slate-900 text-white rounded-full px-3 py-1.5 text-xs font-semibold"
                  : "bg-white border border-slate-200 text-slate-600 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              }
            >
              {VOTED_IN_LABELS[v]}
            </Link>
          ))}
        </div>
      )}

      {/* Active tag filter pill */}
      {activeTag && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-slate-500">Filtered by tag:</span>
          <TagChip name={activeTag.name} color={activeTag.color} />
          <Link
            href="/voter-list"
            className="text-sm text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900"
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

                    <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                      {/* Last contacted date */}
                      {latestResponse?.respondedAt ? (
                        <span className="text-xs text-slate-500">
                          Contacted{" "}
                          {new Date(latestResponse.respondedAt).toLocaleDateString("en-CA", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Not contacted</span>
                      )}

                      {/* Support level badge */}
                      {latestResponse?.supportLevel && (
                        <SupportLevelBadge
                          level={latestResponse.supportLevel as SupportLevel}
                        />
                      )}

                      {/* Other candidate label */}
                      {(latestResponse?.outcome as string) === "other_candidate" && (
                        <span className="text-xs text-slate-500">Other candidate</span>
                      )}

                      {/* Tag chips */}
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
