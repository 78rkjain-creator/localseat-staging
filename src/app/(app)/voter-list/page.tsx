import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAllPeople, canExportData, canAddResident } from "@/lib/permissions";
import { db } from "@/lib/db";
import {
  getPeopleList,
  getPeopleCount,
  getCampaignTags,
} from "@/lib/people";
import { SupportLevelBadge } from "@/components/ui/badge";
import { TagChip } from "@/components/ui/tag-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PeopleSearchBar } from "./search-bar";
import { VoterListDateFilter, ListSourceFilter } from "./filters-client";
import type { Role, SupportLevel, ListSource } from "@/types";
import { LIST_SOURCE_VALUES } from "@/types";

export const metadata: Metadata = { title: "Residents List" };

type SupportFilter = "supporting" | "undecided" | "not_supporting" | "not_contacted";

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

// Filter pill links omit `page` so any filter change resets to page 1.
// Pagination links pass `page` explicitly.
function buildUrl(params: {
  q?: string;
  tag?: string;
  supportFilter?: string;
  contactedAfter?: string;
  cfFilters?: string;
  listSource?: string;
  page?: number;
}) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.tag) p.set("tag", params.tag);
  if (params.supportFilter) p.set("supportFilter", params.supportFilter);
  if (params.contactedAfter) p.set("contactedAfter", params.contactedAfter);
  if (params.cfFilters) p.set("cfFilters", params.cfFilters);
  if (params.listSource) p.set("listSource", params.listSource);
  if (params.page && params.page > 1) p.set("page", String(params.page));
  const s = p.toString();
  return `/voter-list${s ? `?${s}` : ""}`;
}

function toggleCfFilter(fieldId: string, active: string[]): string {
  const next = active.includes(fieldId)
    ? active.filter((id) => id !== fieldId)
    : [...active, fieldId];
  return next.join(",");
}

// Returns at most 7 visible items (numbers + "..." markers) for the desktop
// pagination row. Always includes first and last page.
function getPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

interface PageProps {
  searchParams: Promise<{
    q?: string;
    tag?: string;
    supportFilter?: string;
    contactedAfter?: string;
    cfFilters?: string;
    listSource?: string;
    page?: string;
  }>;
}

type CustomFieldDef = { id: string; label: string };

export default async function VoterListPage({ searchParams }: PageProps) {
  const {
    q,
    tag,
    supportFilter: rawSupportFilter,
    contactedAfter,
    cfFilters: rawCfFilters,
    listSource: rawListSource,
    page: rawPage,
  } = await searchParams;

  const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);

  const supportFilter = (rawSupportFilter && rawSupportFilter in SUPPORT_FILTER_LABELS)
    ? rawSupportFilter as SupportFilter
    : undefined;

  const activeCfFilters: string[] = rawCfFilters
    ? rawCfFilters.split(",").filter(Boolean)
    : [];

  const activeListSources: ListSource[] = rawListSource
    ? (rawListSource.split(",").filter((v) => LIST_SOURCE_VALUES.includes(v as ListSource)) as ListSource[])
    : [];

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole && !canViewAllPeople(activeRole as Role)) redirect("/dashboard");

  const canExport = activeRole ? canExportData(activeRole as Role) : false;
  const canAdd = activeRole ? canAddResident(activeRole as Role) : false;

  const [{ people, total: filteredTotal }, totalCount, allTags, campaignData] = await Promise.all([
    getPeopleList({
      campaignId: activeCampaignId,
      q,
      tagId: tag,
      supportFilter,
      contactedAfter,
      customFieldFilters: activeCfFilters.length > 0 ? activeCfFilters : undefined,
      listSource: activeListSources.length > 0 ? activeListSources : undefined,
      page,
    }),
    getPeopleCount(activeCampaignId),
    getCampaignTags(activeCampaignId),
    db.campaign.findUnique({
      where: { id: activeCampaignId },
      select: { customFields: true },
    }),
  ]);

  const rawCfDefs = campaignData?.customFields;
  const customFieldDefs: CustomFieldDef[] = Array.isArray(rawCfDefs) ? (rawCfDefs as CustomFieldDef[]) : [];

  const totalPages = Math.max(1, Math.ceil(filteredTotal / 50));
  const activeTagId = tag;
  const activeTag = allTags.find((t) => t.id === activeTagId);
  const isFiltered = !!q || !!activeTagId || !!supportFilter || !!contactedAfter || activeCfFilters.length > 0 || (activeListSources.length > 0 && activeListSources.length < LIST_SOURCE_VALUES.length);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Residents List</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isFiltered
              ? <>{filteredTotal.toLocaleString()} of {totalCount.toLocaleString()}</>
              : <>{totalCount.toLocaleString()} total</>
            }
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canAdd && (
            <Link
              href="/voter-list/new"
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add resident
            </Link>
          )}
          {canExport && (
            <a
              href="/voter-list/export"
              download
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </a>
          )}
        </div>
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
              href={buildUrl({ q, tag, supportFilter: pill.value, contactedAfter, cfFilters: rawCfFilters, listSource: rawListSource })}
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
          cfFilters={rawCfFilters}
          listSource={rawListSource}
        />
      </div>

      {/* Custom field filter pills */}
      {customFieldDefs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-slate-400 font-medium">Custom fields:</span>
          {customFieldDefs.map((field) => {
            const isActive = activeCfFilters.includes(field.id);
            const nextCfFilters = toggleCfFilter(field.id, activeCfFilters) || undefined;
            return (
              <Link
                key={field.id}
                href={buildUrl({ q, tag, supportFilter, contactedAfter, cfFilters: nextCfFilters, listSource: rawListSource })}
                className={
                  isActive
                    ? "bg-brand-500 text-white rounded-full px-3 py-1.5 text-xs font-semibold"
                    : "bg-white border border-slate-200 text-slate-600 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                }
              >
                {field.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* List source filter pills */}
      <div className="mb-4">
        <ListSourceFilter
          activeListSources={activeListSources}
          q={q}
          tag={tag}
          supportFilter={supportFilter}
          contactedAfter={contactedAfter}
          cfFilters={rawCfFilters}
        />
      </div>

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

                      {latestResponse?.supportLevel && (
                        <SupportLevelBadge
                          level={latestResponse.supportLevel as SupportLevel}
                        />
                      )}

                      {(latestResponse?.outcome as string) === "other_candidate" && (
                        <span className="text-xs text-slate-500">Other candidate</span>
                      )}

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

          {/* Pagination — only rendered when there is more than one page */}
          {totalPages > 1 && (
            <div className="border-t border-slate-100">

              {/* Mobile: ← Previous | Page X of Y | Next → */}
              <div className="flex md:hidden items-center justify-between px-5 py-4">
                {page > 1 ? (
                  <Link
                    href={buildUrl({ q, tag, supportFilter, contactedAfter, cfFilters: rawCfFilters, listSource: rawListSource, page: page - 1 })}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </span>
                )}

                <span className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </span>

                {page < totalPages ? (
                  <Link
                    href={buildUrl({ q, tag, supportFilter, contactedAfter, cfFilters: rawCfFilters, listSource: rawListSource, page: page + 1 })}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Next
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                    Next
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </div>

              {/* Desktop: numbered pages with ellipsis */}
              <div className="hidden md:flex items-center justify-center gap-1 px-5 py-4">

                {/* Prev arrow */}
                {page > 1 ? (
                  <Link
                    href={buildUrl({ q, tag, supportFilter, contactedAfter, cfFilters: rawCfFilters, listSource: rawListSource, page: page - 1 })}
                    className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    aria-label="Previous page"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </Link>
                ) : (
                  <span className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-300" aria-hidden>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </span>
                )}

                {/* Page number buttons */}
                {getPageRange(page, totalPages).map((pageNum, i) =>
                  pageNum === "..." ? (
                    <span
                      key={`el-${i}`}
                      className="h-9 w-9 flex items-center justify-center text-slate-400 text-sm select-none"
                    >
                      …
                    </span>
                  ) : (
                    <Link
                      key={pageNum}
                      href={buildUrl({ q, tag, supportFilter, contactedAfter, cfFilters: rawCfFilters, listSource: rawListSource, page: pageNum })}
                      aria-current={pageNum === page ? "page" : undefined}
                      className={
                        pageNum === page
                          ? "h-9 w-9 flex items-center justify-center rounded-xl bg-brand-500 text-white text-sm font-semibold"
                          : "h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
                      }
                    >
                      {pageNum}
                    </Link>
                  )
                )}

                {/* Next arrow */}
                {page < totalPages ? (
                  <Link
                    href={buildUrl({ q, tag, supportFilter, contactedAfter, cfFilters: rawCfFilters, listSource: rawListSource, page: page + 1 })}
                    className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    aria-label="Next page"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <span className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-300" aria-hidden>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
