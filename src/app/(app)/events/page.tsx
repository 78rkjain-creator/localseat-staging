import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAllPeople } from "@/lib/permissions";
import { getUpcomingEvents, getPastEvents } from "@/lib/events";
import type { Role } from "@/types";
import type { EventSummary } from "@/lib/events";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewAllPeople(activeRole as Role)) redirect("/dashboard");

  const [upcoming, past] = await Promise.all([
    getUpcomingEvents(activeCampaignId),
    getPastEvents(activeCampaignId),
  ]);

  const canCreate =
    activeRole === "candidate" ||
    activeRole === "campaign_manager" ||
    activeRole === "data_manager" ||
    activeRole === "co_chair" ||
    activeRole === "field_organizer";

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {upcoming.length} upcoming event{upcoming.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/events/new"
            className="inline-flex items-center gap-1.5 h-10 px-4 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-2xl transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New event
          </Link>
        )}
      </div>

      {/* Upcoming */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-700 mb-1">No upcoming events</p>
            {canCreate && (
              <p className="text-xs text-slate-400">
                <Link href="/events/new" className="text-brand-500 hover:underline">Create one</Link> to get started.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Past ({past.length})
          </h2>
          <div className="flex flex-col gap-3">
            {past.map((event) => (
              <EventCard key={event.id} event={event} past />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EventCard({ event, past = false }: { event: EventSummary; past?: boolean }) {
  const dateStr = event.date.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = fmtTime(event.startTime) + (event.endTime ? ` – ${fmtTime(event.endTime)}` : "");

  const typeLabel = EVENT_TYPE_LABELS[event.eventType] ?? event.eventType;

  return (
    <Link href={`/events/${event.id}`}>
      <div className={[
        "bg-white rounded-2xl border px-5 py-4 hover:border-slate-300 hover:shadow-soft transition-all cursor-pointer",
        past ? "opacity-70 border-slate-100" : "border-slate-200",
      ].join(" ")}>
        <div className="flex items-start gap-4">
          <div className={[
            "h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5",
            past ? "bg-slate-100" : "bg-brand-50",
          ].join(" ")}>
            <svg className={["h-5 w-5", past ? "text-slate-400" : "text-brand-500"].join(" ")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-900">{event.name}</p>
              <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                {typeLabel}
              </span>
              {event.status === "cancelled" && (
                <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold bg-red-100 text-red-600 border border-red-200">
                  Cancelled
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {dateStr} · {timeStr}
              {event.location ? ` · ${event.location}` : ""}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {event.attendeeCount} {event.attendeeCount === 1 ? "attendee" : "attendees"}
            </p>
          </div>

          <svg className="h-4 w-4 text-slate-300 flex-shrink-0 self-center" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
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
