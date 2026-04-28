"use client";

import { useActionState } from "react";
import { saveGeneralSettings } from "./actions";
import type { GeneralSettingsState } from "./actions";

interface Props {
  name: string;
  electionDateValue: string;
  fundraisingGoal: number | null;
}

const initialState: GeneralSettingsState = {};

export function GeneralSettingsForm({ name, electionDateValue, fundraisingGoal }: Props) {
  const [state, formAction, isPending] = useActionState(saveGeneralSettings, initialState);

  return (
    <form action={formAction}>
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
