"use client";

import { useState, useTransition } from "react";
import { createVolunteerShift } from "./actions";

export function NewShiftButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New shift
      </button>
      {open && <ShiftModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ShiftModal({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createVolunteerShift({
        name: fd.get("name") as string,
        date: fd.get("date") as string,
        startTime: fd.get("startTime") as string,
        endTime: fd.get("endTime") as string,
        location: fd.get("location") as string,
        notes: fd.get("notes") as string,
        maxVolunteers: fd.get("maxVolunteers") as string,
      });
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
        window.location.reload();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Create volunteer shift</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg" aria-label="Close">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <Field label="Shift name" required>
            <input name="name" required placeholder="e.g. Saturday canvass prep" className={inputCls} />
          </Field>

          <Field label="Date" required>
            <input name="date" type="date" required className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time" required>
              <input name="startTime" type="time" required className={inputCls} />
            </Field>
            <Field label="End time" required>
              <input name="endTime" type="time" required className={inputCls} />
            </Field>
          </div>

          <Field label="Location">
            <input name="location" placeholder="Address or venue name" className={inputCls} />
          </Field>

          <Field label="Max volunteers">
            <input name="maxVolunteers" type="number" min="1" placeholder="No limit" className={inputCls} />
          </Field>

          <Field label="Notes">
            <textarea name="notes" rows={2} className={`${inputCls} resize-none`} />
          </Field>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
              {pending ? "Creating…" : "Create shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
