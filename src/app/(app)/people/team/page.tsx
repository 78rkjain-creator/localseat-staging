import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAllPeople } from "@/lib/permissions";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/ui/empty-state";
import { PeopleSearchBar } from "../search-bar";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Team" };

const ROLE_LABELS: Record<string, string> = {
  candidate: "Candidate",
  campaign_manager: "Campaign Manager",
  field_organizer: "Field Organizer",
  canvasser: "Canvasser",
  volunteer_coordinator: "Volunteer Coordinator",
  finance_lead: "Finance Lead",
};

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function TeamPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole && !canViewAllPeople(activeRole as Role)) redirect("/dashboard");

  const baseWhere = {
    campaignId: activeCampaignId,
    deletedAt: null,
    listSource: "team" as const,
  };

  const searchWhere = q?.trim()
    ? {
        ...baseWhere,
        OR: [
          { firstName: { contains: q.trim(), mode: "insensitive" as const } },
          { lastName: { contains: q.trim(), mode: "insensitive" as const } },
          { email: { contains: q.trim(), mode: "insensitive" as const } },
        ],
      }
    : baseWhere;

  const [people, total] = await Promise.all([
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
              where: { campaignId: activeCampaignId, deletedAt: null },
              select: { role: true },
              take: 1,
            },
          },
        },
        linkedDonors: {
          where: { deletedAt: null },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.person.count({ where: baseWhere }),
  ]);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Team</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {total.toLocaleString()} campaign team {total !== 1 ? "members" : "member"}
        </p>
      </div>

      {/* Search */}
      <div className="mb-5">
        <PeopleSearchBar defaultValue={q ?? ""} />
      </div>

      {/* List */}
      {people.length === 0 ? (
        <EmptyState
          title="No team members"
          description="Campaign team members will appear here once they have been added to the campaign."
        />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {people.map((person) => {
              const role = person.user?.memberships[0]?.role;
              const roleLabel = role ? (ROLE_LABELS[role] ?? role) : null;
              const hasDonorRecord = person.linkedDonors.length > 0;

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
                      {hasDonorRecord && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Donor
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
