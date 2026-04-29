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
import { ListSource } from "@prisma/client";

export const metadata: Metadata = { title: "Out-of-District People" };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  not_required: "Not required",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  not_required: "bg-slate-100 text-slate-500 border-slate-200",
};

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function OutOfDistrictPage({ searchParams }: PageProps) {
  const { q, status: rawStatus } = await searchParams;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole && !canViewAllPeople(activeRole as Role)) redirect("/dashboard");

  const validStatuses = ["pending", "approved", "rejected"];
  const activeStatus = rawStatus && validStatuses.includes(rawStatus) ? rawStatus : undefined;

  const baseWhere = {
    campaignId: activeCampaignId,
    deletedAt: null,
    isOutOfDistrict: true,
    listSource: { not: ListSource.team },
  };

  const statusWhere = activeStatus ? { outOfDistrictApprovalStatus: activeStatus as "pending" | "approved" | "rejected" } : {};

  const searchWhere = q?.trim()
    ? {
        ...baseWhere,
        ...statusWhere,
        OR: [
          { firstName: { contains: q.trim(), mode: "insensitive" as const } },
          { lastName: { contains: q.trim(), mode: "insensitive" as const } },
          { email: { contains: q.trim(), mode: "insensitive" as const } },
          { phoneHome: { contains: q.trim(), mode: "insensitive" as const } },
        ],
      }
    : { ...baseWhere, ...statusWhere };

  const [people, total, campaign] = await Promise.all([
    db.person.findMany({
      where: searchWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        outOfDistrictApprovalStatus: true,
        listSource: true,
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
        canvassResponses: {
          orderBy: { respondedAt: "desc" },
          take: 1,
          select: { supportLevel: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 100,
    }),
    db.person.count({ where: baseWhere }),
    db.campaign.findUnique({
      where: { id: activeCampaignId },
      select: { wardBoundary: true },
    }),
  ]);

  const hasWardBoundary = campaign?.wardBoundary !== null && campaign?.wardBoundary !== undefined;

  const STATUS_PILLS = [
    { label: "All", value: undefined },
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ];

  function buildUrl(status: string | undefined) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    const s = p.toString();
    return `/people/out-of-district${s ? `?${s}` : ""}`;
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Out-of-District</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {total.toLocaleString()} out-of-district {total !== 1 ? "people" : "person"}
        </p>
      </div>

      {/* No ward boundary warning */}
      {!hasWardBoundary && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-amber-800">
            No ward boundary is configured — out-of-district detection is disabled.{" "}
            <Link href="/campaign-settings/ward" className="font-medium underline underline-offset-2 hover:text-amber-900">
              Configure ward boundary
            </Link>
          </p>
        </div>
      )}

      {/* Search */}
      <div className="mb-3">
        <PeopleSearchBar defaultValue={q ?? ""} />
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {STATUS_PILLS.map((pill) => {
          const isActive = activeStatus === pill.value;
          return (
            <Link
              key={pill.label}
              href={buildUrl(pill.value)}
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

      {/* List */}
      {people.length === 0 ? (
        <EmptyState
          title="No out-of-district people"
          description="People marked as out-of-district will appear here."
        />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {people.map((person) => {
              const address = person.household?.address;
              const addressLine = address
                ? `${address.streetNumber} ${address.streetName}${
                    address.unitNumber ? ` #${address.unitNumber}` : ""
                  }`
                : null;
              const status = person.outOfDistrictApprovalStatus ?? "pending";
              const latestResponse = person.canvassResponses[0];

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
                      {latestResponse?.supportLevel && (
                        <SupportLevelBadge
                          level={latestResponse.supportLevel as SupportLevel}
                        />
                      )}
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          STATUS_COLORS[status] ?? "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {STATUS_LABELS[status] ?? status}
                      </span>
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

          {people.length === 100 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-sm text-slate-500 text-center">
                Showing first 100 results &mdash; use search to narrow down
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
