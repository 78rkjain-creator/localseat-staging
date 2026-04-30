import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewTeamDirectory, hasMinimumRole } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getNeedsGeocodeCount } from "@/lib/people";
import { EmptyState } from "@/components/ui/empty-state";
import { PeopleSearchBar } from "../search-bar";
import { BulkGeocodeButton } from "../bulk-geocode-button";
import type { Role } from "@/types";
import type { Prisma } from "@prisma/client";
import { Role as PrismaRole, WardStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Team" };

const LEADERSHIP_ROLES = [
  PrismaRole.candidate,
  PrismaRole.campaign_manager,
  PrismaRole.data_manager,
  PrismaRole.co_chair,
  PrismaRole.field_organizer,
  PrismaRole.volunteer_coordinator,
  PrismaRole.finance_lead,
];

const ROLE_LABELS: Partial<Record<PrismaRole, string>> = {
  candidate: "Candidate",
  campaign_manager: "Campaign Manager",
  data_manager: "Data Manager",
  co_chair: "Co-Chair",
  field_organizer: "Field Organizer",
  volunteer_coordinator: "Volunteer Coordinator",
  finance_lead: "Finance Lead",
};

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

function buildUrl(params: { q?: string; missing?: string }) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.missing) p.set("missing", params.missing);
  const s = p.toString();
  return `/people/team${s ? `?${s}` : ""}`;
}

interface PageProps {
  searchParams: Promise<{ q?: string; missing?: string }>;
}

export default async function TeamPage({ searchParams }: PageProps) {
  const { q, missing: rawMissing } = await searchParams;

  const activeMissing: string[] = rawMissing
    ? rawMissing.split(",").filter(Boolean)
    : [];

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  // All authenticated campaign members can view the leadership directory
  if (activeRole && !canViewTeamDirectory(activeRole as Role)) redirect("/dashboard");

  const canBulkGeocode = activeRole
    ? hasMinimumRole(activeRole as Role, "field_organizer" as Role)
    : false;

  const baseWhere: Prisma.PersonWhereInput = {
    campaignId: activeCampaignId,
    deletedAt: null,
    anonymizedAt: null,
    userId: { not: null },
    user: {
      memberships: {
        some: {
          campaignId: activeCampaignId,
          deletedAt: null,
          role: { in: LEADERSHIP_ROLES },
        },
      },
    },
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
        ],
      }
    : filterWhere;

  const [people, total, needsGeocodeCount] = await Promise.all([
    db.person.findMany({
      where: searchWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isOutOfDistrict: true,
        user: {
          select: {
            memberships: {
              where: {
                campaignId: activeCampaignId,
                deletedAt: null,
                role: { in: LEADERSHIP_ROLES },
              },
              select: { role: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.person.count({ where: baseWhere }),
    getNeedsGeocodeCount(activeCampaignId),
  ]);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {total.toLocaleString()} leadership {total !== 1 ? "members" : "member"}
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
          title="No leadership members"
          description="Campaign leadership members will appear here once they have been added to the campaign with a leadership role."
        />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {people.map((person) => {
              const role = person.user?.memberships[0]?.role;
              const roleLabel = role ? (ROLE_LABELS[role] ?? role) : null;

              return (
                <li key={person.id}>
                  <Link
                    href={`/people/${person.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-violet-600">
                        {person.firstName[0]}
                        {person.lastName[0]}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">
                        {person.firstName} {person.lastName}
                      </p>
                      {person.email && (
                        <p className="text-sm text-slate-500 truncate">{person.email}</p>
                      )}
                    </div>

                    <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                      {roleLabel && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                          {roleLabel}
                        </span>
                      )}
                      {person.isOutOfDistrict ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600 border border-orange-200">
                          Out of district
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          In district
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
        </div>
      )}
    </div>
  );
}
