import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewVolunteers, canManageVolunteers, hasMinimumRole } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getNeedsGeocodeCount } from "@/lib/people";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { PeopleSearchBar } from "../search-bar";
import { BulkGeocodeButton } from "../bulk-geocode-button";
import { AddVolunteerButton, RemoveVolunteerButton } from "./volunteer-client";
import { RoleEditorCell } from "../role-editor-client";
import type { Role } from "@/types";
import type { Prisma } from "@prisma/client";
import { Role as PrismaRole, WardStatus } from "@prisma/client";
import type { VolunteerTier } from "./volunteer-client";

export const metadata: Metadata = { title: "Volunteers" };

const WORKING_ROLES: PrismaRole[] = [PrismaRole.canvasser, PrismaRole.sign_installer];

// Dropdown options for the volunteers-page role editor
const VOLUNTEERS_EDITOR_ROLES: Role[] = [
  "canvasser",
  "sign_installer",
  "field_organizer",
  "volunteer_coordinator",
];

const TIER_ORDER: Record<VolunteerTier, number> = {
  canvasser: 0,
  sign_installer: 1,
  volunteer: 2,
};

const TIER_LABELS: Record<VolunteerTier, string> = {
  canvasser: "Canvasser",
  sign_installer: "Sign Installer",
  volunteer: "Volunteer",
};

const TIER_COLORS: Record<VolunteerTier, string> = {
  canvasser: "bg-violet-50 text-violet-700 border-violet-200",
  sign_installer: "bg-orange-50 text-orange-600 border-orange-200",
  volunteer: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function getTier(memberRole: string | null | undefined): VolunteerTier {
  if (memberRole === "canvasser") return "canvasser";
  if (memberRole === "sign_installer") return "sign_installer";
  return "volunteer";
}

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

const PAGE_SIZE = 100;

function buildUrl(params: { q?: string; missing?: string; page?: number }) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.missing) p.set("missing", params.missing);
  if (params.page && params.page > 1) p.set("page", String(params.page));
  const s = p.toString();
  return `/people/volunteers${s ? `?${s}` : ""}`;
}

interface PageProps {
  searchParams: Promise<{ q?: string; missing?: string; page?: string }>;
}

export default async function VolunteersPage({ searchParams }: PageProps) {
  const { q, missing: rawMissing, page: rawPage } = await searchParams;

  const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);

  const activeMissing: string[] = rawMissing
    ? rawMissing.split(",").filter(Boolean)
    : [];

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewVolunteers(activeRole as Role)) redirect("/dashboard");

  const currentUserId = session.user.id;
  const canManage = activeRole ? canManageVolunteers(activeRole as Role) : false;
  const canBulkGeocode = activeRole
    ? hasMinimumRole(activeRole as Role, "field_organizer" as Role)
    : false;

  const workingMembershipFilter: Prisma.CampaignMembershipWhereInput = {
    campaignId: activeCampaignId,
    deletedAt: null,
    role: { in: WORKING_ROLES },
  };

  // UNION: canvasser/sign_installer members OR pure volunteers (no working membership)
  const baseWhere: Prisma.PersonWhereInput = {
    campaignId: activeCampaignId,
    deletedAt: null,
    anonymizedAt: null,
    OR: [
      {
        user: { memberships: { some: workingMembershipFilter } },
      },
      {
        AND: [
          {
            OR: [
              { volunteerRecords: { some: { deletedAt: null } } },
              { canvassResponses: { some: { volunteerInterest: true } } },
            ],
          },
          {
            NOT: {
              user: { memberships: { some: workingMembershipFilter } },
            },
          },
        ],
      },
    ],
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
          { household: { address: { streetNumber: { contains: q.trim(), mode: "insensitive" } } } },
          { household: { address: { streetName: { contains: q.trim(), mode: "insensitive" } } } },
          { household: { address: { unitNumber: { contains: q.trim(), mode: "insensitive" } } } },
          { household: { address: { city: { contains: q.trim(), mode: "insensitive" } } } },
          { household: { address: { postalCode: { contains: q.trim(), mode: "insensitive" } } } },
        ],
      }
    : filterWhere;

  const [rawPeople, total, needsGeocodeCount] = await Promise.all([
    db.person.findMany({
      where: searchWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneMobile: true,
        phoneHome: true,
        userId: true,
        volunteerRecords: {
          where: { deletedAt: null },
          select: { status: true },
          take: 1,
        },
        user: {
          select: {
            memberships: {
              where: workingMembershipFilter,
              select: { id: true, role: true },
              take: 1,
            },
          },
        },
      },
    }),
    db.person.count({ where: baseWhere }),
    getNeedsGeocodeCount(activeCampaignId),
  ]);

  // Sort: canvassers → sign_installers → volunteers, then alpha within each tier
  const sortedPeople = [...rawPeople].sort((a, b) => {
    const ta = TIER_ORDER[getTier(a.user?.memberships[0]?.role)];
    const tb = TIER_ORDER[getTier(b.user?.memberships[0]?.role)];
    if (ta !== tb) return ta - tb;
    const la = a.lastName.toLowerCase();
    const lb = b.lastName.toLowerCase();
    if (la !== lb) return la < lb ? -1 : 1;
    return a.firstName.toLowerCase() < b.firstName.toLowerCase() ? -1 : 1;
  });

  const filteredTotal = sortedPeople.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const people = sortedPeople.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Volunteers</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {total.toLocaleString()} {total !== 1 ? "volunteers" : "volunteer"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canBulkGeocode && <BulkGeocodeButton initialCount={needsGeocodeCount} />}
        </div>
      </div>

      {/* Add volunteer panel (managers only) */}
      {canManage && <AddVolunteerButton />}

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
          title="No volunteers"
          description="Canvassers, sign installers, and contacts who expressed volunteer interest appear here."
        />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {people.map((person) => {
              const membership = person.user?.memberships[0];
              const membershipId = membership?.id;
              const memberRole = membership?.role ?? null;
              const tier = getTier(memberRole);
              const tierLabel = TIER_LABELS[tier];
              const tierColor = TIER_COLORS[tier];
              const phone = person.phoneMobile || person.phoneHome;
              const fullName = `${person.firstName} ${person.lastName}`;

              // Role editor: visible for working-tier members (canvasser/sign_installer) where
              // editor has manage permission and it's not the editor's own row
              const canEditRow =
                canManage &&
                tier !== "volunteer" &&
                !!membershipId &&
                person.userId !== currentUserId;

              return (
                <li key={person.id} className="group">
                  <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                    {/* Avatar */}
                    <Link href={`/people/${person.id}`} className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center hover:ring-2 hover:ring-emerald-300 transition-all">
                        <span className="text-sm font-semibold text-emerald-600">
                          {person.firstName[0]}
                          {person.lastName[0]}
                        </span>
                      </div>
                    </Link>

                    {/* Name + contact + view record */}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/people/${person.id}`}
                        className="block font-semibold text-slate-900 truncate hover:text-brand-600 transition-colors"
                      >
                        {fullName}
                      </Link>
                      {(person.email || phone) && (
                        <p className="text-sm text-slate-500 truncate">
                          {person.email ?? phone}
                        </p>
                      )}
                      <Link
                        href={`/people/${person.id}`}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        View record
                      </Link>
                    </div>

                    {/* Role editor or tier badge, plus remove button */}
                    <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                      {canEditRow && memberRole ? (
                        <RoleEditorCell
                          membershipId={membershipId}
                          personName={fullName}
                          currentRole={memberRole as Role}
                          availableRoles={VOLUNTEERS_EDITOR_ROLES}
                          context="volunteers"
                        />
                      ) : (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${tierColor}`}
                        >
                          {tierLabel}
                        </span>
                      )}
                      {canManage && (
                        <RemoveVolunteerButton
                          tier={tier}
                          personId={person.id}
                          userId={person.userId}
                          name={fullName}
                        />
                      )}
                    </div>

                    {/* Chevron */}
                    <Link href={`/people/${person.id}`} className="flex-shrink-0">
                      <svg
                        className="h-4 w-4 text-slate-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
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
