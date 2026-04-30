import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAllPeople, canExportData, canAddResident, hasMinimumRole } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getPeopleList, getPeopleCount, getCampaignTags, getNeedsGeocodeCount } from "@/lib/people";
import { deriveSupportBadge } from "@/lib/support-badge";
import { SupportLevelBadge } from "@/components/ui/badge";
import { TagChip } from "@/components/ui/tag-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PeopleSearchBar } from "./search-bar";
import { DistrictClassifyBanner } from "./classify-banner";
import { BulkGeocodeButton } from "./bulk-geocode-button";
import type { UnclassifiedPerson } from "./classify-modal";
import type { Role, SupportLevel } from "@/types";
import { ROLE_LABELS } from "@/types";

export const metadata: Metadata = { title: "People" };

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

const MISSING_FILTER_OPTIONS = [
  { label: "Missing address", value: "missing_address" },
  { label: "Missing phone", value: "missing_phone" },
  { label: "Missing email", value: "missing_email" },
  { label: "Needs classification", value: "needs_classification" },
  { label: "Not geocoded", value: "not_geocoded" },
];

function toggleMissingFilter(key: string, active: string[]): string | undefined {
  const next = active.includes(key)
    ? active.filter((k) => k !== key)
    : [...active, key];
  return next.length > 0 ? next.join(",") : undefined;
}

function buildUrl(params: {
  q?: string;
  tag?: string;
  supportFilter?: string;
  missing?: string;
  volunteer?: string;
  page?: number;
}) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.tag) p.set("tag", params.tag);
  if (params.supportFilter) p.set("supportFilter", params.supportFilter);
  if (params.missing) p.set("missing", params.missing);
  if (params.volunteer) p.set("volunteer", params.volunteer);
  if (params.page && params.page > 1) p.set("page", String(params.page));
  const s = p.toString();
  return `/people${s ? `?${s}` : ""}`;
}

function getPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3)
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

interface PageProps {
  searchParams: Promise<{
    q?: string;
    tag?: string;
    supportFilter?: string;
    missing?: string;
    volunteer?: string;
    page?: string;
  }>;
}

export default async function PeopleMasterListPage({ searchParams }: PageProps) {
  const { q, tag, supportFilter: rawSupportFilter, missing: rawMissing, volunteer: rawVolunteer, page: rawPage } =
    await searchParams;

  const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);

  const supportFilter =
    rawSupportFilter && rawSupportFilter in SUPPORT_FILTER_LABELS
      ? (rawSupportFilter as SupportFilter)
      : undefined;

  const activeMissing: string[] = rawMissing
    ? rawMissing.split(",").filter(Boolean)
    : [];

  const showVolunteer = rawVolunteer === "true";

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole && !canViewAllPeople(activeRole as Role)) redirect("/dashboard");

  const canExport = activeRole ? canExportData(activeRole as Role) : false;
  const canAdd = activeRole ? canAddResident(activeRole as Role) : false;
  const canBulkGeocode = activeRole
    ? hasMinimumRole(activeRole as Role, "field_organizer" as Role)
    : false;

  const [{ people, total: filteredTotal }, totalCount, allTags, unclassifiedPeople, needsGeocodeCount] =
    await Promise.all([
      getPeopleList({
        campaignId: activeCampaignId,
        q,
        tagId: tag,
        supportFilter,
        page,
        missingAddress: activeMissing.includes("missing_address"),
        missingPhone: activeMissing.includes("missing_phone"),
        missingEmail: activeMissing.includes("missing_email"),
        needsClassification: activeMissing.includes("needs_classification"),
        notGeocoded: activeMissing.includes("not_geocoded"),
        volunteerInterest: showVolunteer || undefined,
      }),
      getPeopleCount(activeCampaignId),
      getCampaignTags(activeCampaignId),
      db.person.findMany({
        where: {
          campaignId: activeCampaignId,
          deletedAt: null,
          needsDistrictClassification: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          household: {
            select: {
              address: {
                select: {
                  streetNumber: true,
                  streetName: true,
                  unitNumber: true,
                },
              },
            },
          },
          user: {
            select: {
              memberships: {
                where: { campaignId: activeCampaignId, deletedAt: null },
                select: { role: true },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 100,
      }),
      getNeedsGeocodeCount(activeCampaignId),
    ]);

  const classifyPeople: UnclassifiedPerson[] = unclassifiedPeople.map((p) => {
    const addr = p.household?.address;
    const addressLine = addr
      ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
      : null;
    const role = p.user?.memberships[0]?.role ?? null;
    return { id: p.id, firstName: p.firstName, lastName: p.lastName, addressLine, role };
  });

  const totalPages = Math.max(1, Math.ceil(filteredTotal / 50));
  const activeTagId = tag;
  const activeTag = allTags.find((t) => t.id === activeTagId);
  const isFiltered = !!q || !!activeTagId || !!supportFilter || activeMissing.length > 0 || showVolunteer;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All People</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isFiltered ? (
              <>
                {filteredTotal.toLocaleString()} of {totalCount.toLocaleString()}
              </>
            ) : (
              <>{totalCount.toLocaleString()} total</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canBulkGeocode && <BulkGeocodeButton initialCount={needsGeocodeCount} />}
          {canAdd && (
            <Link
              href="/people/new"
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors shadow-sm"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add resident
            </Link>
          )}
          {canExport && (
            <a
              href="/people/export"
              download
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
            >
              <svg
                className="h-4 w-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export CSV
            </a>
          )}
        </div>
      </div>

      {/* District classification banner */}
      {classifyPeople.length > 0 && (
        <DistrictClassifyBanner
          count={classifyPeople.length}
          campaignId={activeCampaignId}
          people={classifyPeople}
        />
      )}

      {/* Search */}
      <div className="mb-3">
        <PeopleSearchBar defaultValue={q ?? ""} />
      </div>

      {/* Support filter pills */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {SUPPORT_FILTER_PILLS.map((pill) => {
          const isActive = supportFilter === pill.value;
          return (
            <Link
              key={pill.label}
              href={buildUrl({ q, tag, supportFilter: pill.value, missing: rawMissing, volunteer: rawVolunteer })}
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
      </div>

      {/* Volunteer interest filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link
          href={buildUrl({ q, tag, supportFilter, missing: rawMissing, volunteer: showVolunteer ? undefined : "true" })}
          className={
            showVolunteer
              ? "bg-slate-900 text-white rounded-full px-3 py-1.5 text-xs font-semibold"
              : "bg-white border border-slate-200 text-slate-600 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          }
        >
          Volunteer interest
        </Link>
      </div>

      {/* Missing data filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs text-slate-400 font-medium">Missing:</span>
        {MISSING_FILTER_OPTIONS.map((opt) => {
          const isActive = activeMissing.includes(opt.value);
          const next = toggleMissingFilter(opt.value, activeMissing);
          return (
            <Link
              key={opt.value}
              href={buildUrl({ q, tag, supportFilter, missing: next, volunteer: rawVolunteer })}
              className={
                isActive
                  ? "bg-slate-900 text-white rounded-full px-3 py-1.5 text-xs font-semibold"
                  : "bg-white border border-slate-200 text-slate-600 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              }
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {/* Active tag filter */}
      {activeTag && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-slate-500">Filtered by tag:</span>
          <TagChip name={activeTag.name} color={activeTag.color} />
          <Link
            href="/people"
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
            <TagChip key={tag.id} name={tag.name} color={tag.color} tagId={tag.id} />
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
                    href={`/people/${person.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-slate-500">
                        {person.firstName[0]}
                        {person.lastName[0]}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 truncate">
                          {person.firstName} {person.lastName}
                        </p>
                        {person.userId && (
                          <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-100 text-violet-700">
                            {person.user?.memberships[0]?.role
                              ? `Team · ${ROLE_LABELS[person.user.memberships[0].role as Role] ?? person.user.memberships[0].role}`
                              : "Team"}
                          </span>
                        )}
                      </div>
                      {addressLine && (
                        <p className="text-sm text-slate-500 truncate">{addressLine}</p>
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

                      {(() => {
                        const badge = deriveSupportBadge({
                          latestCanvassSupport: latestResponse?.supportLevel as SupportLevel ?? null,
                          importedSupport: person.supportLevel as SupportLevel ?? null,
                        });
                        return badge ? (
                          <SupportLevelBadge level={badge.level} source={badge.source} />
                        ) : null;
                      })()}

                      {(latestResponse?.outcome as string) === "other_candidate" && (
                        <span className="text-xs text-slate-500">Other candidate</span>
                      )}

                      {person.tags.slice(0, 2).map(({ tag }) => (
                        <TagChip key={tag.id} name={tag.name} color={tag.color} />
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
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-slate-100">
              {/* Mobile */}
              <div className="flex md:hidden items-center justify-between px-5 py-4">
                {page > 1 ? (
                  <Link
                    href={buildUrl({ q, tag, supportFilter, missing: rawMissing, volunteer: rawVolunteer, page: page - 1 })}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
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
                    href={buildUrl({ q, tag, supportFilter, missing: rawMissing, volunteer: rawVolunteer, page: page + 1 })}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Next
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                    Next
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </div>

              {/* Desktop */}
              <div className="hidden md:flex items-center justify-center gap-1 px-5 py-4">
                {page > 1 ? (
                  <Link
                    href={buildUrl({ q, tag, supportFilter, missing: rawMissing, volunteer: rawVolunteer, page: page - 1 })}
                    className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    aria-label="Previous page"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </Link>
                ) : (
                  <span
                    className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-300"
                    aria-hidden
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </span>
                )}

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
                      href={buildUrl({ q, tag, supportFilter, missing: rawMissing, volunteer: rawVolunteer, page: pageNum })}
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

                {page < totalPages ? (
                  <Link
                    href={buildUrl({ q, tag, supportFilter, missing: rawMissing, volunteer: rawVolunteer, page: page + 1 })}
                    className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    aria-label="Next page"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <span
                    className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-300"
                    aria-hidden
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
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
