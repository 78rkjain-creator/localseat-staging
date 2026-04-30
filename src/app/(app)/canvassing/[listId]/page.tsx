import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAssignCanvassers, canCanvass, canManageWalkLists, hasMinimumRole } from "@/lib/permissions";
import { db } from "@/lib/db";
import {
  getCanvassListDetail,
  getAvailableCanvassers,
  summariseOutcomes,
} from "@/lib/canvassing";
import type { DynamicFilters } from "@/lib/canvassing";
import { getCampaignTags } from "@/lib/people";
import { deriveSupportBadge } from "@/lib/support-badge";
import { _doRefresh } from "../actions";
import { Card } from "@/components/ui/card";
import { OutcomeBadge, SupportLevelBadge } from "@/components/ui/badge";
import { AssignCanvasserButton } from "./assign-canvasser-button";
import { AddPeopleButton } from "./add-people-button";
import { CsvImportButton } from "./csv-import-button";
import { PrintButton } from "./print-button";
import { OptimizeRouteButton } from "./optimize-route-button";
import { RefreshListButton } from "./refresh-list-button";
import { ArchiveDeleteButtons } from "./archive-delete-buttons";
import { EditListButton } from "./edit-list-button";
import { RemovePersonButton } from "./remove-person-button";
import type { Role, CanvassOutcome, SupportLevel } from "@/types";

interface PageProps {
  params: Promise<{ listId: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export const metadata: Metadata = { title: "Walk list" };

export default async function CanvassListDetailPage({ params, searchParams }: PageProps) {
  const { listId } = await params;
  const { sort: rawSort } = await searchParams;
  const sortDir: "asc" | "desc" = rawSort === "desc" ? "desc" : "asc";

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  // Canvassers always go straight to the door-knocking view.
  if (activeRole === "canvasser") redirect(`/canvassing/${listId}/canvass`);

  // Check whether this user has an active assignment to this specific list.
  const userAssignment = await db.canvassAssignment.findFirst({
    where: { canvassListId: listId, canvasserId: session.user.id, deletedAt: null },
    select: { id: true },
  });

  // Roles below field_organizer can access the page if they're assigned to canvass it.
  const canUserCanvassThisList = activeRole
    ? canCanvass(activeRole as Role) && Boolean(userAssignment)
    : false;

  if (activeRole && !hasMinimumRole(activeRole as Role, "field_organizer") && !canUserCanvassThisList) {
    redirect("/dashboard");
  }

  const canManage = activeRole ? canManageWalkLists(activeRole as Role) : false;
  const canAssign = activeRole ? canAssignCanvassers(activeRole as Role) : false;
  const isManagerRole = activeRole === "candidate" || activeRole === "campaign_manager" || activeRole === "data_manager" || activeRole === "co_chair";
  const isFullAccess = activeRole === "candidate" || activeRole === "campaign_manager" || activeRole === "data_manager";
  const campaignName =
    session.user.memberships.find((m) => m.campaignId === activeCampaignId)?.campaignName ?? "Campaign";

  // Auto-refresh dynamic lists for managers before fetching full detail
  if (isManagerRole) {
    const preview = await db.canvassList.findFirst({
      where: { id: listId, campaignId: activeCampaignId, deletedAt: null },
      select: { dynamicFilters: true },
    });
    if (preview?.dynamicFilters) {
      await _doRefresh(listId, activeCampaignId, session.user.id);
    }
  }

  const [list, availableCanvassers, tags] = await Promise.all([
    getCanvassListDetail(listId, activeCampaignId),
    getAvailableCanvassers(activeCampaignId, listId),
    getCampaignTags(activeCampaignId),
  ]);

  if (!list) notFound();

  const isDynamic = !!list.dynamicFilters;
  const isPending = list.status === "pending_approval";
  const isDraft = list.status === "draft";
  const canAssignNow = canAssign && !isPending;

  const allResponses = list.assignments.flatMap((a) => a.responses);
  const outcomeSummary = summariseOutcomes(allResponses);
  const totalDoors = allResponses.length;

  // Build a set of personIds that have at least one response (for canvassed indicator)
  const canvassedPersonIds = new Set(allResponses.map((r) => r.person.id));

  // Detect whether route optimization has been run (any entry has sortOrder > 0)
  const isOptimized = list.entries.some((e) => e.sortOrder > 0);

  // Geocoded entry count (for optimize button)
  const geocodedEntryCount = list.entries.filter((e) => {
    const addr = e.person.household?.address;
    return addr && "streetNumber" in addr; // address exists = likely geocoded via the walk list
  }).length;

  const isEmpty = list.entries.length === 0;

  // Group entries by base address (streetNumber + streetName, without unit).
  // Units at the same building appear under one header, sorted numerically.
  type EntryWithPerson = (typeof list.entries)[number];
  type GroupData = { displayKey: string; streetNumber: string; streetName: string; entries: EntryWithPerson[] };
  const addressGroups = new Map<string, GroupData>();
  for (const entry of list.entries) {
    const addr = entry.person.household?.address;
    const key = addr ? `${addr.streetNumber} ${addr.streetName}` : "Unknown address";
    if (!addressGroups.has(key)) {
      addressGroups.set(key, {
        displayKey: key,
        streetNumber: addr?.streetNumber ?? "",
        streetName: addr?.streetName ?? "Unknown address",
        entries: [],
      });
    }
    addressGroups.get(key)!.entries.push(entry);
  }
  // Sort units within each building numerically (Prisma sorts unit strings alphabetically).
  for (const group of addressGroups.values()) {
    group.entries.sort((a, b) => {
      const uA = a.person.household?.address?.unitNumber;
      const uB = b.person.household?.address?.unitNumber;
      const nA = uA ? (parseInt(uA, 10) || 0) : -1;
      const nB = uB ? (parseInt(uB, 10) || 0) : -1;
      if (nA !== nB) return nA - nB;
      return a.person.lastName.localeCompare(b.person.lastName);
    });
  }
  // When optimized, insertion order (from sortOrder-sorted DB query) is the route order.
  // When not optimized: streets alphabetical, then street numbers asc/desc within each street.
  const sortedGroups: GroupData[] = isOptimized
    ? [...addressGroups.values()]
    : [...addressGroups.values()].sort((a, b) => {
        const streetCmp = a.streetName.localeCompare(b.streetName);
        if (streetCmp !== 0) return streetCmp;
        const nA = parseInt(a.streetNumber, 10) || 0;
        const nB = parseInt(b.streetNumber, 10) || 0;
        if (nA !== nB) return sortDir === "asc" ? nA - nB : nB - nA;
        return sortDir === "asc"
          ? a.streetNumber.localeCompare(b.streetNumber)
          : b.streetNumber.localeCompare(a.streetNumber);
      });

  const printDate = new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const canvasserNames =
    list.assignments.length === 0
      ? "Unassigned"
      : list.assignments
          .map((a) => `${a.canvasser.firstName} ${a.canvasser.lastName}`)
          .join(", ");

  return (
    <>
    <style dangerouslySetInnerHTML={{ __html: `
      @media print {
        /* Hide app shell */
        aside, nav { display: none !important; }

        /* Remove height / overflow constraints from layout wrappers */
        html, body, body > div, body > div > div {
          height: auto !important;
          overflow: visible !important;
          display: block !important;
        }

        main {
          overflow: visible !important;
          height: auto !important;
          padding-bottom: 0 !important;
          background: white !important;
          width: 100% !important;
        }

        /* Show / hide */
        .no-print { display: none !important; }
        .print-only { display: block !important; }

        /* ── Print layout ── */
        .wl-print-wrap {
          font-family: system-ui, -apple-system, sans-serif;
          padding: 0;
          color: #0f172a;
        }

        .wl-print-header { margin-bottom: 18px; }
        .wl-print-header h1 { font-size: 20px; font-weight: 700; margin: 0 0 3px; }
        .wl-print-header h2 { font-size: 13px; font-weight: 400; color: #64748b; margin: 0 0 10px; }
        .wl-print-meta {
          display: flex;
          gap: 24px;
          font-size: 11px;
          color: #64748b;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 10px;
          margin-bottom: 16px;
        }

        .wl-print-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
          page-break-inside: auto;
        }

        .wl-print-table thead { display: table-header-group; }

        .wl-print-table th {
          background: #f1f5f9 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-weight: 700;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          padding: 5px 8px;
          border: 1px solid #cbd5e1;
          text-align: left;
          white-space: nowrap;
        }

        .wl-print-table td {
          padding: 6px 8px;
          border: 1px solid #e2e8f0;
          vertical-align: top;
          line-height: 1.4;
        }

        .wl-print-table tr { page-break-inside: avoid; }

        .wl-print-addr-row td {
          background: #f8fafc !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-weight: 600;
          font-size: 10px;
          border-top: 2px solid #94a3b8;
          padding: 4px 8px;
          color: #334155;
        }

        .wl-print-table .col-support { width: 64px; }
        .wl-print-table .col-notes   { width: 130px; }
        .wl-print-table .col-poll    { width: 52px; }
        .wl-print-table .col-canvass { width: 80px; }
        .wl-print-table .col-phone   { width: 100px; white-space: nowrap; }
      }
    `}} />

    <div className="no-print px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Back */}
      <Link
        href="/canvassing"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Canvassing
      </Link>

      {/* Status banners */}
      {isPending && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <svg className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Pending approval</p>
            <p className="text-xs text-amber-700 mt-0.5">
              This list is awaiting approval from a campaign manager. Canvassers cannot be assigned until approved.
            </p>
          </div>
        </div>
      )}
      {isDraft && list.rejectionReason && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-800">List returned</p>
            <p className="text-xs text-red-700 mt-0.5">{list.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{list.name}</h1>
            {isDynamic && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700 border border-sky-200">
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Dynamic
              </span>
            )}
          </div>
          {list.description && (
            <p className="text-slate-500 text-sm mt-1">{list.description}</p>
          )}
          {isDynamic && (
            <div className="flex items-center gap-3 mt-1.5">
              <p className="text-xs text-slate-400">
                {list.lastRefreshedAt
                  ? `Last refreshed ${new Date(list.lastRefreshedAt).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                  : "Not yet refreshed"}
              </p>
              {canManage && <RefreshListButton listId={list.id} />}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0 items-end">
          {/* Row 1: operational actions */}
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {canUserCanvassThisList && (
              isEmpty ? (
                <button
                  type="button"
                  disabled
                  title="Add people to this list to enable this action"
                  className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl bg-brand-600 text-white text-sm font-semibold shadow-sm opacity-50 cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Canvass this list
                </button>
              ) : (
                <Link
                  href={`/canvassing/${listId}/canvass`}
                  className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Canvass this list
                </Link>
              )
            )}
            {canAssignNow && (
              <OptimizeRouteButton
                listId={list.id}
                geocodedCount={geocodedEntryCount}
                totalCount={list.entries.length}
                disabled={isEmpty}
              />
            )}
            {isEmpty ? (
              <button
                type="button"
                disabled
                title="Add people to this list to enable this action"
                className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium shadow-sm opacity-50 cursor-not-allowed"
              >
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                View list on map
              </button>
            ) : (
              <Link
                href={`/canvassing/${list.id}/map`}
                className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
              >
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                View list on map
              </Link>
            )}
            {canAssignNow && availableCanvassers.length > 0 && (
              <AssignCanvasserButton listId={list.id} canvassers={availableCanvassers} />
            )}
          </div>
          {/* Row 2: management actions */}
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {canAssign && (
              <EditListButton
                listId={list.id}
                currentName={list.name}
                isDynamic={isDynamic}
                currentFilters={isDynamic ? (list.dynamicFilters as DynamicFilters | null) : null}
                tags={tags}
              />
            )}
            {canManage && (
              <ArchiveDeleteButtons
                listId={list.id}
                listName={list.name}
                isArchived={list.status === "archived"}
                canDelete={isFullAccess}
              />
            )}
            <PrintButton disabled={isEmpty} />
            {canManage && (
              isEmpty ? (
                <button
                  type="button"
                  disabled
                  title="Add people to this list to enable this action"
                  className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium shadow-sm opacity-50 cursor-not-allowed"
                >
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
              ) : (
                <a
                  href={`/canvassing/export?listId=${list.id}`}
                  download
                  className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </a>
              )
            )}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="People in list" value={list.entries.length} />
        <StatCard label="Doors knocked" value={totalDoors} />
        <StatCard label="Contacted" value={outcomeSummary["contacted"] ?? 0} accent />
        <StatCard label="Canvassers" value={list.assignments.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Canvassers card */}
          <Card padding="md">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Assigned canvassers
            </h2>

            {list.assignments.length === 0 ? (
              <p className="text-sm text-slate-400">No canvassers assigned yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {list.assignments.map((assignment) => {
                  const distinctDoors = new Set(assignment.responses.map((r) => r.person.id)).size;
                  const completionPct = list.entries.length > 0
                    ? Math.min(100, Math.round((distinctDoors / list.entries.length) * 100))
                    : 0;
                  return (
                    <li key={assignment.id} className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-slate-500">
                          {assignment.canvasser.firstName[0]}
                          {assignment.canvasser.lastName[0]}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">
                          {assignment.canvasser.firstName} {assignment.canvasser.lastName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {distinctDoors} door{distinctDoors !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {distinctDoors > 0 && (
                        <span className={[
                          "text-xs font-semibold flex-shrink-0",
                          completionPct >= 75 ? "text-emerald-600" :
                          completionPct >= 50 ? "text-amber-600" : "text-red-500",
                        ].join(" ")}>
                          {completionPct}%
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {canAssignNow && availableCanvassers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <AssignCanvasserButton
                  listId={list.id}
                  canvassers={availableCanvassers}
                  variant="secondary"
                  label="Assign canvasser"
                />
              </div>
            )}
            {isPending && canManage && (
              <p className="text-xs text-amber-600 mt-3">
                Approve this list before assigning canvassers.
              </p>
            )}
          </Card>

          {/* Outcome breakdown */}
          {totalDoors > 0 && (
            <Card padding="md">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Outcome breakdown
              </h2>
              <ul className="flex flex-col gap-2">
                {Object.entries(outcomeSummary)
                  .sort((a, b) => b[1] - a[1])
                  .map(([outcome, count]) => (
                    <li key={outcome} className="flex items-center justify-between">
                      <OutcomeBadge outcome={outcome as CanvassOutcome} />
                      <span className="text-sm font-semibold text-slate-700">{count}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* People in list */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                People in list
                {list.entries.length > 0 && (
                  <span className="ml-2 text-slate-400 font-normal normal-case">
                    ({list.entries.length})
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                {list.entries.length > 0 && !isOptimized && (
                  <Link
                    href={`/canvassing/${listId}?sort=${sortDir === "asc" ? "desc" : "asc"}`}
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    title={sortDir === "asc" ? "Switch to high → low" : "Switch to low → high"}
                  >
                    {sortDir === "asc" ? (
                      <>
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                        </svg>
                        Low → High
                      </>
                    ) : (
                      <>
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                        </svg>
                        High → Low
                      </>
                    )}
                  </Link>
                )}
                {canManage && !isDynamic && (
                  <>
                    <AddPeopleButton listId={list.id} tags={tags} />
                    <CsvImportButton listId={list.id} />
                  </>
                )}
              </div>
            </div>

            {list.entries.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500 mb-3">No people on this list yet.</p>
                {canManage && (
                  <p className="text-xs text-slate-400">
                    Use "Add people" to filter from your campaign data, or "Import CSV" to upload a file.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4 -mx-5 sm:-mx-8">
                {sortedGroups.map(({ displayKey: addressLine, entries: groupEntries }) => {
                  const isBuilding = groupEntries.length > 1 || groupEntries.some(e => e.person.household?.address?.unitNumber);
                  return (
                  <div key={addressLine}>
                    <div className="px-5 sm:px-8 py-1.5 bg-slate-50 border-y border-slate-100 flex items-center gap-1.5">
                      {isBuilding && (
                        <svg className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      )}
                      <p className="text-xs font-medium text-slate-500">{addressLine}</p>
                      {isBuilding && groupEntries.length > 1 && (
                        <span className="text-xs text-slate-400">{groupEntries.length} units</span>
                      )}
                    </div>
                    <ul>
                      {groupEntries.map((entry) => {
                        const isCanvassed = canvassedPersonIds.has(entry.person.id);
                        const latestResponse = entry.person.canvassResponses[0];
                        const unit = entry.person.household?.address?.unitNumber;
                        return (
                          <li
                            key={entry.id}
                            className="flex items-center gap-3 px-5 sm:px-8 py-3 border-b border-slate-50 last:border-0"
                          >
                            {/* Canvassed indicator */}
                            <div
                              className={[
                                "h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0",
                                isCanvassed
                                  ? "bg-emerald-100"
                                  : "bg-slate-100",
                              ].join(" ")}
                              title={isCanvassed ? "Canvassed" : "Not yet canvassed"}
                            >
                              {isCanvassed ? (
                                <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  href={`/people/${entry.person.id}`}
                                  className="text-sm font-medium text-slate-800 hover:text-slate-600 transition-colors"
                                >
                                  {entry.person.firstName} {entry.person.lastName}
                                </Link>
                                {unit && (
                                  <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Unit {unit}</span>
                                )}
                                {entry.person.pollNumber && (
                                  <span className="text-xs text-slate-400">Poll {entry.person.pollNumber}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {(() => {
                                const badge = deriveSupportBadge({
                                  latestCanvassSupport: latestResponse?.supportLevel as SupportLevel ?? null,
                                  importedSupport: entry.person.supportLevel as SupportLevel ?? null,
                                });
                                return badge ? (
                                  <SupportLevelBadge level={badge.level} source={badge.source} />
                                ) : null;
                              })()}
                              {isCanvassed && latestResponse && !latestResponse.supportLevel && (
                                <OutcomeBadge outcome={latestResponse.outcome as CanvassOutcome} />
                              )}
                              {canAssign && !isDynamic && (
                                <RemovePersonButton
                                  listId={list.id}
                                  entryId={entry.id}
                                  hasResponses={isCanvassed}
                                />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Canvass results */}
          {allResponses.length > 0 && (
            <Card padding="md">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Canvass results
              </h2>
              <ul className="divide-y divide-slate-100 -mx-5 sm:-mx-8">
                {allResponses
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.respondedAt).getTime() -
                      new Date(a.respondedAt).getTime()
                  )
                  .map((response) => {
                    const address = response.person.household?.address;
                    const addressLine = address
                      ? `${address.streetNumber} ${address.streetName}${
                          address.unitNumber ? ` #${address.unitNumber}` : ""
                        }`
                      : "Unknown address";
                    // Cast to pick up competitor relation — Prisma types update after prisma generate
                    const r = response as unknown as { competitor?: { name: string } | null };
                    return (
                      <li key={response.id} className="flex items-start gap-3 px-5 sm:px-8 py-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <OutcomeBadge outcome={response.outcome as CanvassOutcome} />
                          {(response.outcome as string) === "other_candidate" && r.competitor?.name && (
                            <p className="text-xs text-slate-500 mt-1">Supporting: {r.competitor.name}</p>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/people/${response.person.id}`}
                            className="text-sm font-medium text-slate-800 hover:text-brand-600 transition-colors"
                          >
                            {response.person.firstName} {response.person.lastName}
                          </Link>
                          <p className="text-xs text-slate-400">{addressLine}</p>
                          {response.notes && (
                            <p className="text-xs text-slate-500 mt-0.5 italic">
                              &ldquo;{response.notes}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                          {response.supportLevel && (
                            <SupportLevelBadge level={response.supportLevel as SupportLevel} />
                          )}
                          <div className="flex gap-1.5">
                            {response.signRequest && <FlagDot label="Sign" color="blue" />}
                            {response.volunteerInterest && <FlagDot label="Vol" color="green" />}
                            {response.donorInterest && <FlagDot label="Donor" color="orange" />}
                          </div>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>{/* end no-print */}

    {/* ── Print-only walk list ── hidden on screen, shown by @media print ── */}
    <div className="print-only" style={{ display: "none" }}>
      <div className="wl-print-wrap">

        <div className="wl-print-header">
          <h1>{campaignName}</h1>
          <h2>Walk List: {list.name}</h2>
          <div className="wl-print-meta">
            <span>Date: {printDate}</span>
            <span>Canvassers: {canvasserNames}</span>
            <span>{list.entries.length} people</span>
          </div>
        </div>

        {list.entries.length === 0 ? (
          <p style={{ fontSize: "12px", color: "#64748b" }}>No people on this list yet.</p>
        ) : (
          <table className="wl-print-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Name</th>
                <th className="col-phone">Phone</th>
                <th className="col-poll">Poll #</th>
                <th className="col-canvass">Last Canvass</th>
                <th className="col-support">Support</th>
                <th className="col-notes">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.flatMap(({ displayKey: addressKey, entries: groupEntries }) =>
                groupEntries.map((entry, personIdx) => {
                  const isFirst = personIdx === 0;
                  const unit = entry.person.household?.address?.unitNumber;
                  const phone = entry.person.phoneMobile ?? entry.person.phoneHome ?? "";
                  const latestResponse = entry.person.canvassResponses[0];
                  const canvassStatus = !latestResponse
                    ? ""
                    : latestResponse.supportLevel
                    ? (({ strong_yes: "Strong Yes", soft_yes: "Soft Yes", undecided: "Undecided", soft_no: "Soft No", strong_no: "Strong No" } as Record<string, string>)[latestResponse.supportLevel] ?? "")
                    : (({ not_home: "Not home", refused: "Refused", moved: "Moved", unavailable: "Unavailable", deceased: "Deceased", other_candidate: "Other cand." } as Record<string, string>)[latestResponse.outcome] ?? "");
                  return (
                    <tr
                      key={entry.id}
                      style={isFirst ? { borderTop: "2px solid #94a3b8" } : undefined}
                    >
                      <td style={{ fontWeight: isFirst ? 600 : "normal", color: isFirst ? "#334155" : "inherit" }}>
                        {isFirst ? addressKey : (unit ? `Unit ${unit}` : "")}
                      </td>
                      <td>{entry.person.firstName} {entry.person.lastName}</td>
                      <td className="col-phone">{phone}</td>
                      <td className="col-poll">{entry.person.pollNumber ?? ""}</td>
                      <td className="col-canvass">{canvassStatus}</td>
                      <td className="col-support" />
                      <td className="col-notes" />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card padding="sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">
        {value}
      </p>
    </Card>
  );
}

function FlagDot({ label, color }: { label: string; color: "blue" | "green" | "orange" }) {
  const colorMap = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-emerald-100 text-emerald-600",
    orange: "bg-orange-100 text-orange-600",
  };
  return (
    <span className={["inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium", colorMap[color]].join(" ")}>
      {label}
    </span>
  );
}
