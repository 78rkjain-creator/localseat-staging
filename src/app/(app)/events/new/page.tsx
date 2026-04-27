import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAllPeople } from "@/lib/permissions";
import { db } from "@/lib/db";
import { createEvent } from "../actions";
import type { Role } from "@/types";

async function handleCreate(formData: FormData) {
  "use server";
  await createEvent(formData);
}

export const metadata: Metadata = { title: "New Event" };

export default async function NewEventPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (
    activeRole !== "candidate" &&
    activeRole !== "campaign_manager" &&
    activeRole !== "co_chair" &&
    activeRole !== "field_organizer"
  ) {
    redirect("/events");
  }

  const lists = await db.canvassList.findMany({
    where: { campaignId: activeCampaignId, deletedAt: null, status: { in: ["active", "draft"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New event</h1>
        <p className="text-slate-500 text-sm mt-0.5">Schedule a campaign activity</p>
      </div>

      <form action={handleCreate}>
        <div className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Event name</label>
            <input
              name="name"
              type="text"
              required
              maxLength={120}
              placeholder="e.g. Canvass Kickoff — Elm Street"
              className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Type</label>
            <select
              name="eventType"
              className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent appearance-none"
            >
              <option value="campaign_event">Campaign Event</option>
              <option value="fundraiser">Fundraiser</option>
              <option value="town_hall">Town Hall</option>
              <option value="debate">Debate</option>
              <option value="canvass_kickoff">Canvass Kickoff</option>
              <option value="volunteer_training">Volunteer Training</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Date</label>
            <input
              name="date"
              type="date"
              required
              defaultValue={today}
              className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Start time</label>
              <input
                name="startTime"
                type="time"
                required
                defaultValue="09:00"
                className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                End time <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                name="endTime"
                type="time"
                className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Location <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              name="location"
              type="text"
              maxLength={200}
              placeholder="e.g. Community Centre, 123 Main St"
              className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              name="description"
              rows={3}
              maxLength={1000}
              placeholder="Details, agenda, or notes about this event…"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Walk list link */}
          {lists.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Walk list <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <select
                name="canvassListId"
                className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent appearance-none"
              >
                <option value="">— None —</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <a
              href="/events"
              className="flex-1 h-11 flex items-center justify-center rounded-2xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </a>
            <button
              type="submit"
              className="flex-1 h-11 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-2xl transition-colors"
            >
              Create event
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
