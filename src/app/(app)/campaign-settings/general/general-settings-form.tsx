"use client";

import { useActionState, useState } from "react";
import { saveGeneralSettings } from "./actions";
import type { GeneralSettingsState } from "./actions";

interface VotingDate {
  date: string;
  time: string;
}

interface Props {
  name: string;
  electionDateValue: string;
  fundraisingGoal: number | null;
  advanceVotingDates: VotingDate[];
}

const initialState: GeneralSettingsState = {};

export function GeneralSettingsForm({ name, electionDateValue, fundraisingGoal, advanceVotingDates }: Props) {
  const [state, formAction, isPending] = useActionState(saveGeneralSettings, initialState);
  const [vDates, setVDates] = useState<VotingDate[]>(advanceVotingDates);

  function addDate() {
    setVDates((d) => [...d, { date: "", time: "09:00" }]);
  }

  function removeDate(idx: number) {
    setVDates((d) => d.filter((_, i) => i !== idx));
  }

  function updateDate(idx: number, field: "date" | "time", value: string) {
    setVDates((d) => d.map((entry, i) => i === idx ? { ...entry, [field]: value } : entry));
  }

  return (
    <form action={formAction}>
      {/* Hidden count for advance voting dates */}
      <input type="hidden" name="advanceDateCount" value={vDates.length} />
      {vDates.map((entry, i) => (
        <span key={i}>
          <input type="hidden" name={`advanceDate_${i}`} value={entry.date} />
          <input type="hidden" name={`advanceTime_${i}`} value={entry.time} />
        </span>
      ))}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">

        {/* Campaign name */}
        <div className="px-5 py-5">
          <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Campaign name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={name}
            placeholder="e.g. Alex Chen for Ward 3"
            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            Shown in the sidebar and on exports.
          </p>
        </div>

        {/* Election date */}
        <div className="px-5 py-5">
          <label htmlFor="electionDate" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Election date
          </label>
          <input
            id="electionDate"
            name="electionDate"
            type="date"
            defaultValue={electionDateValue}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            Used on the dashboard to show days remaining.
          </p>
        </div>

        {/* Fundraising goal */}
        <div className="px-5 py-5">
          <label htmlFor="fundraisingGoal" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Fundraising goal
          </label>
          <div className="relative inline-flex items-center">
            <span className="absolute left-3 text-sm text-slate-400 pointer-events-none">$</span>
            <input
              id="fundraisingGoal"
              name="fundraisingGoal"
              type="number"
              min="0"
              step="1"
              defaultValue={fundraisingGoal ?? ""}
              placeholder="0"
              className="h-10 pl-7 pr-3 w-40 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Shown on the finance dashboard as a progress target.
          </p>
        </div>

        {/* Advance voting dates */}
        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Advance voting dates</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Dates when advance polls are open.
              </p>
            </div>
          </div>

          {vDates.length === 0 ? (
            <p className="text-sm text-slate-400 mb-3">No advance voting dates set.</p>
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              {vDates.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={entry.date}
                    onChange={(e) => updateDate(i, "date", e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    type="time"
                    value={entry.time}
                    onChange={(e) => updateDate(i, "time", e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeDate(i)}
                    className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                    title="Remove this date"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addDate}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add another date
          </button>
        </div>

      </div>

      {state.error && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {state.error}
        </p>
      )}

      {state.success && (
        <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
          Settings saved.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="h-10 px-6 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
