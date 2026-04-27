"use client";

import { useState, useTransition } from "react";
import { refreshDynamicList } from "../actions";

interface Props {
  listId: string;
}

export function RefreshListButton({ listId }: Props) {
  const [result, setResult] = useState<{ added: number; removed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    setResult(null);
    setError(null);
    startTransition(async () => {
      const res = await refreshDynamicList(listId);
      if (res.error) {
        setError(res.error);
      } else {
        setResult({ added: res.added ?? 0, removed: res.removed ?? 0 });
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg
          className={["h-3.5 w-3.5 text-slate-400", isPending ? "animate-spin" : ""].join(" ")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {isPending ? "Refreshing…" : "Refresh now"}
      </button>
      {result && !isPending && (
        <span className="text-xs text-slate-500">
          +{result.added} added, {result.removed} removed
        </span>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
