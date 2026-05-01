"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { copyEvent } from "../actions";
import type { EventType } from "@prisma/client";

interface SourceEvent {
  id: string;
  name: string;
  description: string | null;
  dateValue: string;  // "YYYY-MM-DD"
  startTime: string;
  endTime: string | null;
  location: string | null;
  eventType: EventType;
}

interface Props {
  source: SourceEvent;
  canCreate: boolean;
}

const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: "campaign_event", label: "Campaign Event" },
  { value: "fundraiser", label: "Fundraiser" },
  { value: "town_hall", label: "Town Hall" },
  { value: "debate", label: "Debate" },
  { value: "canvass_kickoff", label: "Canvass Kickoff" },
  { value: "volunteer_training", label: "Volunteer Training" },
  { value: "other", label: "Other" },
];

export function CopyEventModal({ source, canCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await copyEvent(source.id, formData);
      if (result.error) {
        setError(result.error);
      } else if (result.newEventId) {
        router.push(`/events/${result.newEventId}`);
      }
    });
  }

  if (!canCreate) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Copy event
      </button>

      <Modal open={open} onClose={handleClose} title="Copy event" maxWidth="max-w-lg">
        <p className="text-sm text-slate-500 mb-5">
          Creates a new event pre-filled with these details. Attendees are not copied.
        </p>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Event name</label>
              <input
                name="name"
                type="text"
                required
                maxLength={120}
                defaultValue={`Copy of ${source.name}`}
                className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Type</label>
              <select
                name="eventType"
                defaultValue={source.eventType}
                className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent appearance-none"
              >
                {EVENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Date</label>
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={source.dateValue}
                  className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Start time</label>
                <input
                  name="startTime"
                  type="time"
                  required
                  defaultValue={source.startTime}
                  className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">End time</label>
                <input
                  name="endTime"
                  type="time"
                  defaultValue={source.endTime ?? ""}
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
                defaultValue={source.location ?? ""}
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
                defaultValue={source.description ?? ""}
                placeholder="Details, agenda, or notes…"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" fullWidth onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" fullWidth loading={isPending} disabled={isPending}>
                Save copy
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
