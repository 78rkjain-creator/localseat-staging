"use client";

import { useState, useTransition } from "react";
import { toggleGotvMode, saveVoteTarget } from "./actions";

interface Props {
  voteTarget: number | null;
  electionDate: string | null;
  advanceVotingDates: string[];
}

export function GotvSetup({ voteTarget, electionDate, advanceVotingDates }: Props) {
  const [target, setTarget] = useState(voteTarget?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasElectionDate = !!electionDate;
  const daysToElection = electionDate
    ? Math.max(0, Math.ceil((new Date(electionDate).getTime() - Date.now()) / 86400000))
    : null;

  function handleEnable() {
    startTransition(async () => {
      setError(null);
      const parsedTarget = target.trim() ? parseInt(target, 10) : null;
      if (parsedTarget !== null && (isNaN(parsedTarget) || parsedTarget < 1)) {
        setError("Vote target must be a positive number.");
        return;
      }

      if (parsedTarget !== null) {
        const targetResult = await saveVoteTarget(parsedTarget);
        if (targetResult.error) {
          setError(targetResult.error);
          return;
        }
      }

      const result = await toggleGotvMode(true);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="h-16 w-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Get out the vote</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Activate GOTV mode to switch to election day operations.
        </p>
      </div>

      {!hasElectionDate && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6">
          <p className="text-sm text-amber-700">
            Set an election date in{" "}
            <a href="/campaign-settings/general" className="font-semibold underline">
              campaign settings
            </a>{" "}
            before enabling GOTV mode.
          </p>
        </div>
      )}

      {daysToElection !== null && daysToElection > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 mb-6 text-center">
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{daysToElection}</p>
          <p className="text-sm text-slate-500">days to election</p>
        </div>
      )}

      {advanceVotingDates.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Advance poll dates
          </p>
          <div className="flex flex-wrap gap-2">
            {advanceVotingDates.map((d) => (
              <span key={d} className="text-sm text-slate-700 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                {new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-5 mb-6">
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          Vote target (win number)
        </label>
        <p className="text-xs text-slate-400 mb-3">
          How many votes do you need to win? This powers the countdown on election day.
        </p>
        <input
          type="number"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="e.g. 3500"
          min={1}
          className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleEnable}
        disabled={isPending}
        className="w-full h-12 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-2xl transition-colors"
      >
        {isPending ? "Activating…" : "Activate GOTV mode"}
      </button>

      <p className="text-xs text-slate-400 text-center mt-4">
        You can deactivate GOTV mode at any time from the GOTV dashboard.
      </p>
    </div>
  );
}
