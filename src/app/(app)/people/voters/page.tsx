import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAllPeople, hasMinimumRole } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getNeedsGeocodeCount } from "@/lib/people";
import { SupportLevelBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { PeopleSearchBar } from "../search-bar";
import { BulkGeocodeButton } from "../bulk-geocode-button";
import type { Role, SupportLevel } from "@/types";
import type { Prisma } from "@prisma/client";
import { WardStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Voter List" };

const PAGE_SIZE = 100;

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

function buildUrl(params: { q?: string; missing?: string; page?: number }) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.missing) p.set("missing", params.missing);
  if (params.page && params.page > 1) p.set("page", String(params.page));
  const s = p.toString();
  return `/people/voters${s ? `?${s}` : ""}`;
}

interface PageProps {
  searchParams: Promise<{ q?: string; missing?: string; page?: string }>;
}

export default async function VotersPage({ searchParams }: PageProps) {
  const { q, missing: rawMissing, page: rawPage } = await searchParams;

  const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);

  const activeMissing: string[] = rawMissing
    ? rawMissing.split(",").filter(Boolean)
    : [];

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole && !canViewAllPeople(activeRole as Role)) redirect("/dashboard");

  const canBulkGeocode = activeRole
    ? hasMinimumRole(activeRole as Role, "field_organizer" as Role)
    : false;

  const baseWhere: Prisma.PersonWhereInput = {
    campaignId: activeCampaignId,
    deletedAt: null,
    isConfirmedVoter: true,
  };

  const missingAnd: Prisma.PersonWhereInput[] = [];
  if (activeMissing.includes("missing_address")) {
    missingAnd.push({
      OR: [
        { householdId: null },
        { household: { address: { streetNumber: "", streetName: "", city: "" } } },
      ],
    });
  }
  if (activeMissing.includes("missing_phone")) {
    missingAnd.push({ phoneHome: null, phoneMobile: null });
  }
  if (activeMissing.includes("missing_email")) {
    missingAnd.push({ email: null });
  }
  if (activeMissing.includes("needs_classification")) {
    missingAnd.push({ wardStatus: WardStatus.not_checked, householdId: { not: null } });
  }
  if (activeMissing.includes("not_geocoded")) {
    missingAnd.push({ householdId: { not: null }, household: { address: { lat: null } } });
  }

  const filterWhere: Prisma.PersonWhereInput =
    missingAnd.length > 0 ? { ...baseWhere, AND: missingAnd } : baseWhere;

  const searchWhere: Prisma.PersonWhereInput = q?.trim()
    ? {
        ...filterWhere,
        OR: [
          { firstName: { contains: q.trim(), mode: "insensitive" } },
          { lastName: { contains: q.trim(), mode: "insensitive" } },
          { email: { contains: q.trim(), mode: "insensitive" } },
          { phoneHome: { contains: q.trim(), mode: "insensitive" } },
          { household: { address: { streetNumber: { contains: q.trim(), mode: "insensitive" } } } },
          { household: { address: { streetName: { contains: q.trim(), mode: "insensitive" } } } },
          { household: { address: { unitNumber: { contains: q.trim(), mode: "insensitive" } } } },
          { household: { address: { city: { contains: q.trim(), mode: "insensitive" } } } },
          { household: { address: { postalCode: { contains: q.trim(), mode: "insensitive" } } } },
        ],
      }
    : filterWhere;

  const [people, total, filteredTotal, needsGeocodeCount] = await Promise.all([
    db.person.findMany({
      where: searchWhere,
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
                city: true,
              },
            },
          },
        },
        canvassResponses: {
          orderBy: { respondedAt: "desc" },
          take: 1,
          select: { supportLevel: true, outcome: true, respondedAt: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.person.count({ where: baseWhere }),
    db.person.count({ where: searchWhere }),
    getNeedsGeocodeCount(activeCampaignId),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const isFiltered = !!q?.trim() || activeMissing.length > 0;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Voter List</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isFiltered ? (
              <>
                {filteredTotal.toLocaleString()} of {total.toLocaleString()} confirmed voter{total !== 1 ? "s" : ""}
              </>
            ) : (
              <>{total.toLocaleString()} confirmed voter{total !== 1 ? "s" : ""}</>
            )}
          </p>
        </div>
        {canBulkGeocode && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <BulkGeocodeButton initialCount={needsGeocodeCount} />
          </div>
        )}
      </div>

      {/* Search */}
      <div className="mb-3">
        <PeopleSearchBar defaultValue={q ?? ""} />
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
              href={buildUrl({ q, missing: next })}
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

      {/* List */}
      {people.length === 0 ? (
        <EmptyState
          title={isFiltered ? "No results" : "No confirmed voters yet"}
          description={
            isFiltered
              ? "Try a different name or clear the filter."
              : "Confirmed voters appear here after an Official Voters List is imported and matched."
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
                      <p className="font-semibold text-slate-900 truncate">
                        {person.firstName} {person.lastName}
                      </p>
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
                      {latestResponse?.supportLevel && (
                        <SupportLevelBadge
                          level={latestResponse.supportLevel as SupportLevel}
                        />
                      )}
                      {(latestResponse?.outcome as string) === "other_candidate" && (
                        <span className="text-xs text-slate-500">Other candidate</span>
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

          <Pagination
            page={page}
            totalPages={totalPages}
            buildPageUrl={(p) => buildUrl({ q, missing: rawMissing, page: p })}
          />
        </div>
      )}
    </div>
  );
}
