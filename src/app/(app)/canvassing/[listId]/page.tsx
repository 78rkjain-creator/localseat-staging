import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAssignCanvassers, canManageWalkLists, hasMinimumRole } from "@/lib/permissions";
import {
  getCanvassListDetail,
  getAvailableCanvassers,
  summariseOutcomes,
} from "@/lib/canvassing";
import { getCampaignTags } from "@/lib/people";
import { Card } from "@/components/ui/card";
import { OutcomeBadge, SupportLevelBadge } from "@/components/ui/badge";
import { AssignCanvasserButton } from "./assign-canvasser-button";
import { AddPeopleButton } from "./add-people-button";
import { CsvImportButton } from "./csv-import-button";
import type { Role, CanvassOutcome, SupportLevel } from "@/types";

interface PageProps {
  params: Promise<{ listId: string }>;
}

export const metadata: Metadata = { title: "Walk list" };

export default async function CanvassListDetailPage({ params }: PageProps) {
  const { listId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole === "canvasser") redirect(`/canvassing/${listId}/canvass`);
  if (activeRole && !hasMinimumRole(activeRole as Role, "field_organizer")) {
    redirect("/dashboard");
  }

  const canManage = activeRole ? canManageWalkLists(activeRole as Role) : false;
  const canAssign = activeRole ? canAssignCanvassers(activeRole as Role) : false;

  const [list, availableCanvassers, tags] = await Promise.all([
    getCanvassListDetail(listId, activeCampaignId),
    getAvailableCanvassers(activeCampaignId, listId),
    getCampaignTags(activeCampaignId),
  ]);

  if (!list) notFound();

  const allResponses = list.assignments.flatMap((a) => a.responses);
  const outcomeSummary = summariseOutcomes(allResponses);
  const totalDoors = allResponses.length;

  // Build a set of personIds that have at least one response (for canvassed indicator)
  const canvassedPersonIds = new Set(allResponses.map((r) => r.person.id));

  // Group entries by address for display
  type EntryWithPerson = (typeof list.entries)[number];
  const addressGroups = new Map<string, EntryWithPerson[]>();
  for (const entry of list.entries) {
    const addr = entry.person.household?.address;
    const key = addr
      ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
      : "Unknown address";
    if (!addressGroups.has(key)) addressGroups.set(key, []);
    addressGroups.get(key)!.push(entry);
  }
  const sortedGroups = [...addressGroups.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
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

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{list.name}</h1>
          {list.description && (
            <p className="text-slate-500 text-sm mt-1">{list.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canManage && (
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
          )}
          {canAssign && availableCanvassers.length > 0 && (
            <AssignCanvasserButton listId={list.id} canvassers={availableCanvassers} />
          )}
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
                  const assignmentOutcomes = summariseOutcomes(assignment.responses);
                  const doorsForAssignment = assignment.responses.length;
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
                          {doorsForAssignment} door{doorsForAssignment !== 1 ? "s" : ""}
                          {assignmentOutcomes["contacted"]
                            ? ` · ${assignmentOutcomes["contacted"]} contacted`
                            : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {canAssign && availableCanvassers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <AssignCanvasserButton
                  listId={list.id}
                  canvassers={availableCanvassers}
                  variant="secondary"
                  label="Assign canvasser"
                />
              </div>
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
              {canManage && (
                <div className="flex items-center gap-2">
                  <AddPeopleButton listId={list.id} tags={tags} />
                  <CsvImportButton listId={list.id} />
                </div>
              )}
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
                {sortedGroups.map(([addressLine, entries]) => (
                  <div key={addressLine}>
                    <div className="px-5 sm:px-8 py-1.5 bg-slate-50 border-y border-slate-100">
                      <p className="text-xs font-medium text-slate-500">{addressLine}</p>
                    </div>
                    <ul>
                      {entries.map((entry) => {
                        const isCanvassed = canvassedPersonIds.has(entry.person.id);
                        const latestResponse = entry.person.canvassResponses[0];
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
                              <Link
                                href={`/voter-list/${entry.person.id}`}
                                className="text-sm font-medium text-slate-800 hover:text-brand-600 transition-colors"
                              >
                                {entry.person.firstName} {entry.person.lastName}
                              </Link>
                              {entry.person.pollNumber && (
                                <span className="ml-2 text-xs text-slate-400">Poll {entry.person.pollNumber}</span>
                              )}
                            </div>

                            <div className="flex-shrink-0">
                              {latestResponse?.supportLevel && (
                                <SupportLevelBadge
                                  level={latestResponse.supportLevel as SupportLevel}
                                />
                              )}
                              {isCanvassed && latestResponse && !latestResponse.supportLevel && (
                                <OutcomeBadge outcome={latestResponse.outcome as CanvassOutcome} />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
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
                    return (
                      <li key={response.id} className="flex items-start gap-3 px-5 sm:px-8 py-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <OutcomeBadge outcome={response.outcome as CanvassOutcome} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/voter-list/${response.person.id}`}
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
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card padding="sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={["text-2xl font-bold", accent ? "text-brand-500" : "text-slate-900"].join(" ")}>
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
