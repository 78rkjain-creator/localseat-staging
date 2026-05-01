"use client";

import { useActionState, useState } from "react";
import { createEvent } from "../actions";

interface List {
  id: string;
  name: string;
}

interface Props {
  lists: List[];
  today: string;
}

const WEEKDAYS = [
  { label: "Mon", value: 0 },
  { label: "Tue", value: 1 },
  { label: "Wed", value: 2 },
  { label: "Thu", value: 3 },
  { label: "Fri", value: 4 },
  { label: "Sat", value: 5 },
  { label: "Sun", value: 6 },
];

const initialState: { error?: string } = {};

export function NewEventForm({ lists, today }: Props) {
  const [state, formAction, isPending] = useActionState(createEvent, initialState);

  const [recurring, setRecurring] = useState(false);
  const [endType, setEndType] = useState<"count" | "date">("count");

  return (
    <form action={formAction}>
      <input type="hidden" name="recurring" value={recurring ? "true" : "false"} />

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
          <label className="text-sm font-medium text-slate-700">
            {recurring ? "Series start date" : "Date"}
          </label>
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

        {/* Recurring toggle */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <label className="flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer select-none">
            <div>
              <p className="text-sm font-medium text-slate-800">Recurring event</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate one event per occurrence upfront — each is independently editable.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={recurring}
              onClick={() => setRecurring((r) => !r)}
              className={[
                "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                recurring ? "bg-brand-500" : "bg-slate-200",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform",
                  recurring ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          </label>

          {recurring && (
            <div className="border-t border-slate-100 px-4 py-4 flex flex-col gap-4">
              {/* Weekday checkboxes */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Repeats on</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map(({ label, value }) => (
                    <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        name={`weekday_${value}`}
                        className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* End condition */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ends</p>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="endType"
                      value="count"
                      checked={endType === "count"}
                      onChange={() => setEndType("count")}
                      className="h-4 w-4 border-slate-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-sm text-slate-700">After</span>
                    <input
                      type="number"
                      name="endCount"
                      min={1}
                      max={52}
                      defaultValue={6}
                      disabled={endType !== "count"}
                      className="w-16 h-8 px-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-40"
                    />
                    <span className="text-sm text-slate-700">occurrences (max 52)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="endType"
                      value="date"
                      checked={endType === "date"}
                      onChange={() => setEndType("date")}
                      className="h-4 w-4 border-slate-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-sm text-slate-700">On date</span>
                    <input
                      type="date"
                      name="endDate"
                      disabled={endType !== "date"}
                      className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-40"
                    />
                  </label>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Up to 52 events will be created — one per occurrence. Each can be edited or deleted independently.
              </p>
            </div>
          )}
        </div>

        {state.error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-sm text-red-600">{state.error}</p>
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
            disabled={isPending}
            className="flex-1 h-11 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-2xl transition-colors disabled:opacity-60"
          >
            {isPending
              ? (recurring ? "Creating series…" : "Creating…")
              : (recurring ? "Create series" : "Create event")}
          </button>
        </div>
      </div>
    </form>
  );
}
