import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAllPeople, isReadOnly } from "@/lib/permissions";
import { getPersonDetail } from "@/lib/people";
import { Card } from "@/components/ui/card";
import { SupportLevelBadge, OutcomeBadge } from "@/components/ui/badge";
import { TagChip } from "@/components/ui/tag-chip";
import { AddNoteForm } from "./add-note-form";
import { PersonEditForm } from "./person-edit-form";
import { AddressEditButton } from "./address-edit-button";
import type { SupportLevel, CanvassOutcome, OutreachChannel } from "@/types";
import { OUTREACH_CHANNEL_LABELS } from "@/types";
import { getVotingRecordsForPerson, ELECTION_TYPE_LABELS } from "@/lib/voting-records";
import type { VotingRecord } from "@/lib/voting-records";

interface PageProps {
  params: Promise<{ personId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { personId } = await params;
  return { title: "Person" };
}

export default async function PersonDetailPage({ params }: PageProps) {
  const { personId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole && !canViewAllPeople(activeRole as import("@/types").Role)) redirect("/dashboard");
  const readOnly = activeRole ? isReadOnly(activeRole as import("@/types").Role) : false;

  const person = await getPersonDetail(personId, activeCampaignId);
  if (!person) notFound();

  const canSeeVotingHistory =
    activeRole === "candidate" ||
    activeRole === "campaign_manager" ||
    activeRole === "co_chair";

  const votingRecords = canSeeVotingHistory
    ? await getVotingRecordsForPerson(personId, activeCampaignId)
    : [];

  const address = person.household?.address;
  const householdMembers = person.household?.people ?? [];

  type TimelineEvent =
    | { type: "canvass"; date: Date; data: (typeof person.canvassResponses)[number] }
    | { type: "outreach"; date: Date; data: (typeof person.outreachLogs)[number] };

  const timeline: TimelineEvent[] = [
    ...person.canvassResponses.map((r) => ({
      type: "canvass" as const,
      date: new Date(r.respondedAt),
      data: r,
    })),
    ...person.outreachLogs.map((l) => ({
      type: "outreach" as const,
      date: new Date(l.date),
      data: l,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const latestCanvass = person.canvassResponses[0];
  const linkedDonor = person.linkedDonors[0] ?? null;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/voter-list"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Voter List
      </Link>

      {/* Person header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xl font-bold text-slate-500">
            {person.firstName[0]}{person.lastName[0]}
          </span>
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-2xl font-bold text-slate-900">
            {person.firstName} {person.lastName}
          </h1>
          {address && (
            <p className="text-slate-500 mt-0.5">
              {address.streetNumber} {address.streetName}
              {address.unitNumber ? ` #${address.unitNumber}` : ""},{" "}
              {address.city}
            </p>
          )}
          {person.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {person.tags.map(({ tag }) => (
                <TagChip
                  key={tag.id}
                  name={tag.name}
                  color={tag.color}
                  tagId={tag.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: contact + status */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Contact info */}
          <Card padding="md">
            <PersonEditForm
              personId={person.id}
              firstName={person.firstName}
              lastName={person.lastName}
              email={person.email}
              phoneHome={person.phoneHome}
              phoneMobile={person.phoneMobile}
              birthYear={person.birthYear}
              supportLevel={person.supportLevel}
              pollNumber={person.pollNumber ?? null}
            />
            {person.importSource && (
              <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
                Source: {person.importSource}
              </p>
            )}
          </Card>

          {/* Support status */}
          {latestCanvass && (
            <Card padding="md">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Canvass status
              </h2>
              <div className="flex flex-col gap-2">
                <OutcomeBadge outcome={latestCanvass.outcome as CanvassOutcome} />
                {latestCanvass.outcome === "other_candidate" && latestCanvass.competitor?.name && (
                  <p className="text-xs text-slate-500">
                    Supporting: {latestCanvass.competitor.name}
                  </p>
                )}
                {latestCanvass.supportLevel && (
                  <SupportLevelBadge
                    level={latestCanvass.supportLevel as SupportLevel}
                  />
                )}
                <div className="flex flex-wrap gap-2 mt-1">
                  {latestCanvass.signRequest && (
                    <FlagChip label="Yard sign" color="blue" />
                  )}
                  {latestCanvass.volunteerInterest && (
                    <FlagChip label="Volunteer" color="green" />
                  )}
                  {latestCanvass.donorInterest && (
                    <FlagChip label="Donor interest" color="orange" />
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Donor link */}
          {linkedDonor && (
            <Card padding="md">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Donor
              </h2>
              <Link
                href={`/donors/${linkedDonor.id}`}
                className="text-sm text-brand-600 hover:underline"
              >
                View donor record
              </Link>
              <p className="text-xs text-slate-400 mt-1 capitalize">{linkedDonor.status}</p>
            </Card>
          )}

          {/* Household */}
          {person.household && (
            <Card padding="md">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                  Household
                </h2>
                {!readOnly && address && (
                  <AddressEditButton
                    personId={person.id}
                    campaignId={activeCampaignId}
                    currentAddress={address}
                    householdMembers={householdMembers}
                  />
                )}
              </div>
              {address && (
                <p className="text-sm text-slate-600 mb-2">
                  {address.streetNumber} {address.streetName}
                  {address.unitNumber ? ` #${address.unitNumber}` : ""}
                  <br />
                  {address.city}, {address.province} {address.postalCode}
                </p>
              )}
              {householdMembers.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Also at this address
                  </p>
                  {householdMembers.map((m) => (
                    <Link
                      key={m.id}
                      href={`/voter-list/${m.id}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      {m.firstName} {m.lastName}
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Open tasks */}
          {person.tasks.length > 0 && (
            <Card padding="md">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Open tasks
              </h2>
              <ul className="flex flex-col gap-2.5">
                {person.tasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-2">
                    <div className="h-4 w-4 rounded border border-slate-300 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-800">{task.title}</p>
                      {task.dueDate && (
                        <p className={[
                          "text-xs mt-0.5",
                          new Date(task.dueDate) < new Date()
                            ? "text-red-500"
                            : "text-slate-400",
                        ].join(" ")}>
                          Due {formatDate(new Date(task.dueDate))}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Right column: notes + timeline */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Notes */}
          <Card padding="md">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Notes
            </h2>

            {person.notes.length > 0 && (
              <ul className="flex flex-col gap-4 mb-5">
                {person.notes.map((note) => (
                  <li key={note.id} className="flex flex-col gap-1">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {note.body}
                    </p>
                    <p className="text-xs text-slate-400">
                      {note.author.firstName} {note.author.lastName} &middot;{" "}
                      {formatDate(new Date(note.createdAt))}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {!readOnly && <AddNoteForm personId={person.id} />}
          </Card>

          {/* Voting history */}
          {canSeeVotingHistory && votingRecords.length > 0 && (
            <Card padding="md">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Voting history
              </h2>
              <VotingHistoryTable records={votingRecords} />
            </Card>
          )}

          {/* Activity timeline */}
          <Card padding="md">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Activity
            </h2>

            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400">No activity recorded yet.</p>
            ) : (
              <ol className="relative border-l border-slate-100 ml-2 flex flex-col gap-5">
                {timeline.map((event, idx) => (
                  <li key={idx} className="pl-5 relative">
                    <div className="absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-300" />

                    {event.type === "canvass" ? (
                      <CanvassTimelineItem event={event.data} date={event.date} />
                    ) : (
                      <OutreachTimelineItem event={event.data} date={event.date} />
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FlagChip({
  label,
  color,
}: {
  label: string;
  color: "blue" | "green" | "orange";
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  };
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        colorMap[color],
      ].join(" ")}
    >
      {label}
    </span>
  );
}

const OUTREACH_METHOD_LABELS = OUTREACH_CHANNEL_LABELS;

function CanvassTimelineItem({
  event,
  date,
}: {
  event: { outcome: string; supportLevel?: string | null; notes?: string | null; competitor?: { name: string } | null; assignment: { canvasser: { firstName: string; lastName: string }; canvassList: { name: string } } };
  date: Date;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-sm font-medium text-slate-800">Door canvass</span>
        <OutcomeBadge outcome={event.outcome as CanvassOutcome} />
        {event.supportLevel && (
          <SupportLevelBadge level={event.supportLevel as SupportLevel} />
        )}
      </div>
      {event.outcome === "other_candidate" && event.competitor?.name && (
        <p className="text-xs text-slate-500 mb-1">Supporting: {event.competitor.name}</p>
      )}
      {event.notes && (
        <p className="text-sm text-slate-600 mb-1">&ldquo;{event.notes}&rdquo;</p>
      )}
      <p className="text-xs text-slate-400">
        {event.assignment.canvasser.firstName} {event.assignment.canvasser.lastName}{" "}
        &middot; {event.assignment.canvassList.name} &middot;{" "}
        {formatDate(date)}
      </p>
    </div>
  );
}

function OutreachTimelineItem({
  event,
  date,
}: {
  event: { channel: string; outcome?: string | null; notes?: string | null; user?: { firstName: string; lastName: string } | null };
  date: Date;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-800 mb-1">
        {OUTREACH_METHOD_LABELS[event.channel as OutreachChannel] ?? event.channel}
        {event.outcome && (
          <span className="text-slate-500 font-normal"> — {event.outcome}</span>
        )}
      </p>
      {event.notes && (
        <p className="text-sm text-slate-600 mb-1">{event.notes}</p>
      )}
      <p className="text-xs text-slate-400">
        {event.user ? `${event.user.firstName} ${event.user.lastName} · ` : ""}{formatDate(date)}
      </p>
    </div>
  );
}

function VotingHistoryTable({ records }: { records: VotingRecord[] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400 font-medium">
            <th className="text-left pb-2 pr-4">Year</th>
            <th className="text-left pb-2 pr-4">Type</th>
            <th className="text-left pb-2 pr-4">Election</th>
            <th className="text-left pb-2 pr-4">Voted</th>
            <th className="text-left pb-2">Party</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {records.map((r) => (
            <tr key={r.id}>
              <td className="py-2 pr-4 font-medium text-slate-800">{r.electionYear}</td>
              <td className="py-2 pr-4 text-slate-600">{ELECTION_TYPE_LABELS[r.electionType]}</td>
              <td className="py-2 pr-4 text-slate-500">{r.electionName ?? "—"}</td>
              <td className="py-2 pr-4">
                {r.participated ? (
                  <span className="text-emerald-600 font-medium">Yes</span>
                ) : (
                  <span className="text-slate-400">No</span>
                )}
              </td>
              <td className="py-2 text-slate-500">{r.partySupport ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
