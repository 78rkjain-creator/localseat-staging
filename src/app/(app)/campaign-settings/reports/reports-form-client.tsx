"use client";

import { useState, useTransition } from "react";
import { saveReportSettings } from "./actions";

interface Props {
  dailySummaryEnabled: boolean;
  dailySummaryEmail: string | null;
}

export function ReportsFormClient({ dailySummaryEnabled, dailySummaryEmail }: Props) {
  const [enabled, setEnabled] = useState(dailySummaryEnabled);
  const [email, setEmail] = useState(dailySummaryEmail ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (enabled && !email.trim()) {
      setError("Enter an email address to receive daily reports.");
      return;
    }

    startTransition(async () => {
      const result = await saveReportSettings({
        dailySummaryEnabled: enabled,
        dailySummaryEmail: enabled ? email.trim() : null,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Toggle */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Daily summary email</p>
            <p className="text-sm text-slate-500 mt-0.5">
              Receive a daily recap of doors knocked, support breakdown, and open follow-ups.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => { setEnabled((v) => !v); setSaved(false); }}
            className={[
              "relative flex-shrink-0 h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
              enabled ? "bg-brand-500" : "bg-slate-300",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                enabled ? "translate-x-5" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>

        {enabled && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Send reports to
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setSaved(false); }}
              placeholder="campaign@example.com"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Reports are sent once daily at the end of the canvassing day.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {saved && (
        <p className="text-sm text-emerald-600 font-medium">Settings saved.</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="h-10 px-5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
