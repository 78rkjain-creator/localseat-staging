import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAllPeople } from "@/lib/permissions";
import { db } from "@/lib/db";
import { SupportLevelBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PeopleSearchBar } from "../search-bar";
import type { Role, SupportLevel } from "@/types";

export const metadata: Metadata = { title: "Voter List" };

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function ConfirmedVoterListPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole && !canViewAllPeople(activeRole as Role)) redirect("/dashboard");

  const baseWhere = {
    campaignId: activeCampaignId,
    deletedAt: null,
    isConfirmedVoter: true,
  } as const;

  const searchWhere = q?.trim()
    ? {
        ...baseWhere,
        OR: [
          { firstName: { contains: q.trim(), mode: "insensitive" as const } },
          { lastName:  { contains: q.trim(), mode: "insensitive" as const } },
          { email:     { contains: q.trim(), mode: "insensitive" as const } },
          { phoneHome: { contains: q.trim(), mode: "insensitive" as const } },
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
      take: 50,
    }),
    db.person.count({ where: baseWhere }),
  ]);

  const isFiltered = !!q?.trim();

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Voter List</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {total.toLocaleString()} confirmed voter{total !== 1 ? "s" : ""}
          {isFiltered && people.length < total && (
            <> &mdash; showing {people.length} result{people.length !== 1 ? "s" : ""}</>
          )}
        </p>
      </div>

      {/* Search */}
      <div className="mb-5">
        <PeopleSearchBar defaultValue={q ?? ""} />
      </div>

      {/* List */}
      {people.length === 0 ? (
        <EmptyState
          title={isFiltered ? "No results" : "No confirmed voters yet"}
          description={
            isFiltered
              ? "Try a different name or clear the search."
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
                ? `${address.streetNumber} ${address.streetName}${address.unitNumber ? ` #${address.unitNumber}` : ""}`
                : null;

              return (
                <li key={person.id}>
                  <Link
                    href={`/voter-list/confirmed/${person.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-slate-500">
                        {person.firstName[0]}{person.lastName[0]}
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
                        <SupportLevelBadge level={latestResponse.supportLevel as SupportLevel} />
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
