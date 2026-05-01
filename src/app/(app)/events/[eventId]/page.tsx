import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAllPeople } from "@/lib/permissions";
import { getEvent, getCampaignMembers } from "@/lib/events";
import { isEventsEnabled } from "@/lib/plan-limits";
import { UpgradeCard } from "@/components/upgrade-card";
import { FEATURE_METADATA } from "@/lib/feature-metadata";
import { updateEventStatus, deleteEvent } from "../actions";
import { AttendeePanel } from "./attendee-panel";
import { CopyEventModal } from "./copy-event-modal";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Event" };

interface PageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventDetailPage({ params }: PageProps) {
  const { eventId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewAllPeople(activeRole as Role)) redirect("/dashboard");

  if (!await isEventsEnabled(activeCampaignId)) {
    const meta = FEATURE_METADATA["events"];
    return (
      <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
        <UpgradeCard
          featureName={meta.name}
          featureDescription={meta.description}
          requiredPlan={meta.requiredPlan}
          campaignId={activeCampaignId}
        />
      </div>
    );
  }

  const [event, members] = await Promise.all([
    getEvent(eventId, activeCampaignId),
    getCampaignMembers(activeCampaignId),
  ]);

  if (!event) notFound();

  const canManage =
    activeRole === "candidate" ||
    activeRole === "campaign_manager" ||
    activeRole === "data_manager" ||
    activeRole === "co_chair" ||
    activeRole === "field_organizer";

  const canDelete = activeRole === "candidate" || activeRole === "campaign_manager" || activeRole === "data_manager";

  const dateStr = event.date.toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = fmtTime(event.startTime) + (event.endTime ? ` – ${fmtTime(event.endTime)}` : "");
  const typeLabel = EVENT_TYPE_LABELS[event.eventType] ?? event.eventType;

  const attended = event.attendees.filter((a) => a.status === "attended").length;
  const total = event.attendees.length;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      {/* Back */}
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Events
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl font-bold text-slate-900">{event.name}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <CopyEventModal
              canCreate={canManage}
              source={{
                id: event.id,
                name: event.name,
                description: event.description,
                dateValue: event.date.toISOString().slice(0, 10),
                startTime: event.startTime,
                endTime: event.endTime,
                location: event.location,
                eventType: event.eventType,
              }}
            />
            <StatusBadge status={event.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <span>{dateStr}</span>
          <span>{timeStr}</span>
          {event.location && <span>{event.location}</span>}
          <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
            {typeLabel}
          </span>
        </div>
        {event.description && (
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">{event.description}</p>
        )}
        {event.canvassListName && (
          <p className="text-xs text-slate-400 mt-2">
            Walk list:{" "}
            <Link href={`/canvassing/${event.canvassListId}`} className="text-brand-500 hover:underline">
              {event.canvassListName}
            </Link>
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-white rounded-2xl border border-slate-100 px-4 py-4 text-center">
          <p className="text-3xl font-bold text-slate-900">{total}</p>
          <p className="text-xs text-slate-400 mt-0.5">Registered</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 px-4 py-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{attended}</p>
          <p className="text-xs text-slate-400 mt-0.5">Attended</p>
        </div>
      </div>

      {/* Status actions */}
      {canManage && event.status !== "cancelled" && (
        <div className="mb-8 flex flex-wrap gap-2">
          {event.status === "upcoming" && (
            <form action={async () => {
              "use server";
              await updateEventStatus(eventId, "in_progress");
            }}>
              <button type="submit" className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
                Mark in progress
              </button>
            </form>
          )}
          {(event.status === "upcoming" || event.status === "in_progress") && (
            <form action={async () => {
              "use server";
              await updateEventStatus(eventId, "completed");
            }}>
              <button type="submit" className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors">
                Mark completed
              </button>
            </form>
          )}
          <form action={async () => {
            "use server";
            await updateEventStatus(eventId, "cancelled");
          }}>
            <button type="submit" className="h-9 px-4 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors">
              Cancel event
            </button>
          </form>
        </div>
      )}

      {/* Attendees */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">
          Attendees {total > 0 ? `(${total})` : ""}
        </h2>
        <AttendeePanel
          eventId={eventId}
          attendees={event.attendees}
          members={members}
          canManage={canManage}
        />
      </div>

      {/* Danger zone */}
      {canDelete && (
        <div className="border-t border-slate-100 pt-6">
          <form action={async () => {
            "use server";
            await deleteEvent(eventId);
          }}>
            <button
              type="submit"
              className="text-xs text-red-500 hover:text-red-700 hover:underline transition-colors"
            >
              Delete this event
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    upcoming: "bg-sky-100 text-sky-700 border-sky-200",
    in_progress: "bg-amber-100 text-amber-700 border-amber-200",
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled: "bg-red-100 text-red-600 border-red-200",
  };
  const labels: Record<string, string> = {
    upcoming: "Upcoming",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return (
    <span className={[
      "inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold border",
      styles[status] ?? "bg-slate-100 text-slate-600 border-slate-200",
    ].join(" ")}>
      {labels[status] ?? status}
    </span>
  );
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  campaign_event: "Campaign Event",
  fundraiser: "Fundraiser",
  town_hall: "Town Hall",
  debate: "Debate",
  canvass_kickoff: "Canvass Kickoff",
  volunteer_training: "Volunteer Training",
  other: "Other",
};
