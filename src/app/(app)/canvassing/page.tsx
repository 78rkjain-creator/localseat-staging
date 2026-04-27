import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canCanvass, canManageWalkLists } from "@/lib/permissions";
import { getCanvassLists, getAssignedLists } from "@/lib/canvassing";
import { getCampaignTags } from "@/lib/people";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NewListButton } from "./new-list-button";
import { ApproveRejectButtons } from "./approve-reject-buttons";
import { ArchivedSection } from "./archived-section";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Canvassing" };

export default async function CanvassingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  if (activeRole === "canvasser") {
    return <CanvasserView userId={session.user.id} campaignId={activeCampaignId} />;
  }

  if (activeRole && !canCanvass(activeRole as Role)) {
    redirect("/dashboard");
  }

  const [allLists, tags] = await Promise.all([
    getCanvassLists(activeCampaignId),
    getCampaignTags(activeCampaignId),
  ]);

  const canManage = activeRole ? canManageWalkLists(activeRole as Role) : false;
  const isApprover = activeRole === "candidate" || activeRole === "campaign_manager" || activeRole === "co_chair";
  const isFieldOrganizer = activeRole === "field_organizer";

  // Split lists by status for display
  const pendingLists = isApprover
    ? allLists.filter((l) => l.status === "pending_approval")
    : isFieldOrganizer
    ? allLists.filter((l) => l.status === "pending_approval")
    : [];
  const activeLists = allLists.filter(
    (l) => l.status === "active" || l.status === "draft"
  );
  const archivedLists = allLists.filter((l) => l.status === "archived");
  const visibleLists = activeLists;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Canvassing</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {activeLists.length} active walk list{activeLists.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Link
              href="/canvassing/turf"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Create walk list from map
            </Link>
            <NewListButton tags={tags} />
          </div>
        )}
      </div>

      {/* Pending approval section — visible to approvers */}
      {pendingLists.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Pending Approval</h2>
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
              {pendingLists.length}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {pendingLists.map((list) => {
              const assigneeNames = list.assignments
                .map((a) => `${a.canvasser.firstName} ${a.canvasser.lastName}`)
                .slice(0, 3)
                .join(", ");

              return (
                <Card key={list.id} padding="md" className="border-amber-200 bg-amber-50">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link href={`/canvassing/${list.id}`} className="font-semibold text-slate-900 hover:text-slate-700 transition-colors">
                          {list.name}
                        </Link>
                        {list.dynamicFilters && (
                          <DynamicBadge />
                        )}
                      </div>
                      {list.description && (
                        <p className="text-sm text-slate-500 truncate">{list.description}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {list.totalEntries} {list.totalEntries === 1 ? "person" : "people"}
                        {assigneeNames ? ` · ${assigneeNames}` : ""}
                      </p>
                      <div className="mt-3">
                        <ApproveRejectButtons listId={list.id} listName={list.name} />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Active lists */}
      {visibleLists.length === 0 && pendingLists.length === 0 ? (
        <EmptyState
          title="No walk lists yet"
          description="Create a walk list to start assigning canvassers and tracking door knocks."
          action={canManage ? <NewListButton tags={tags} /> : undefined}
        />
      ) : visibleLists.length === 0 ? null : (
        <>
          {(pendingLists.length > 0 || archivedLists.length > 0) && (
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-slate-700">Active Lists</h2>
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                {visibleLists.length}
              </span>
            </div>
          )}
        <div className="flex flex-col gap-3">
          {visibleLists.map((list) => {
            const assigneeNames = list.assignments
              .map((a) => `${a.canvasser.firstName} ${a.canvasser.lastName}`)
              .slice(0, 3)
              .join(", ");
            const extraAssignees =
              list.assignments.length > 3
                ? ` +${list.assignments.length - 3} more`
                : "";
            const isPending = list.status === "pending_approval";

            return (
              <Link key={list.id} href={`/canvassing/${list.id}`}>
                <Card
                  padding="md"
                  className="hover:border-slate-200 hover:shadow-soft transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{list.name}</p>
                        {list.dynamicFilters && <DynamicBadge />}
                        {isPending && <PendingBadge />}
                        {list.status === "draft" && <DraftBadge />}
                      </div>
                      {list.description && (
                        <p className="text-sm text-slate-500 mt-0.5 truncate">{list.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                        {list.assignments.length > 0 ? (
                          <span className="text-xs text-slate-500">
                            {assigneeNames}{extraAssignees}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No canvassers assigned</span>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <p className="text-2xl font-bold text-slate-900">{list.totalResponses}</p>
                      <p className="text-xs text-slate-400">doors</p>
                    </div>

                    <svg className="h-4 w-4 text-slate-300 flex-shrink-0 self-center" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
        </>
      )}

      <ArchivedSection lists={archivedLists} />
    </div>
  );
}

// ── Badges ─────────────────────────────────────────────────────────────────

function DynamicBadge() {
  return (
    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700 border border-sky-200">
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Dynamic
    </span>
  );
}

function PendingBadge() {
  return (
    <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
      Pending approval
    </span>
  );
}

function DraftBadge() {
  return (
    <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
      Draft
    </span>
  );
}

// ── Canvasser view ─────────────────────────────────────────────────────────

async function CanvasserView({ userId, campaignId }: { userId: string; campaignId: string }) {
  const assignments = await getAssignedLists(userId, campaignId);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My lists</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {assignments.length} list{assignments.length !== 1 ? "s" : ""} assigned to you
        </p>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          title="No lists assigned yet"
          description="Your organizer will assign you a walk list when you're ready to start canvassing."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {assignments.map((a) => {
            const pct =
              a.totalEntries > 0
                ? Math.min(100, Math.round((a.totalResponses / a.totalEntries) * 100))
                : 0;
            const remaining = Math.max(0, a.totalEntries - a.totalResponses);

            return (
              <Card key={a.assignmentId} padding="md">
                <div className="flex items-start gap-4 mb-4">
                  <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{a.list.name}</p>
                    {a.list.description && (
                      <p className="text-sm text-slate-500 mt-0.5 truncate">{a.list.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-bold text-slate-900">{pct}%</p>
                    <p className="text-xs text-slate-400">done</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-800 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs text-slate-400">
                    <span>{a.totalResponses} recorded</span>
                    <span>{remaining} remaining</span>
                  </div>
                </div>

                <Link
                  href={`/canvassing/${a.list.id}/canvass`}
                  className={[
                    "flex items-center justify-center gap-2 h-12 w-full rounded-2xl font-semibold text-sm transition-colors",
                    remaining > 0
                      ? "bg-brand-500 hover:bg-brand-600 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600",
                  ].join(" ")}
                >
                  {remaining > 0
                    ? a.totalResponses === 0 ? "Start canvassing" : "Continue canvassing"
                    : "Review list"}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
