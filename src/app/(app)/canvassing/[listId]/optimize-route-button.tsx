"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { optimizeRoute } from "../actions";

interface Props {
  listId: string;
  geocodedCount: number;
  totalCount: number;
}

export function OptimizeRouteButton({ listId, geocodedCount, totalCount }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const msg =
      geocodedCount < totalCount
        ? `Optimize route for ${geocodedCount} of ${totalCount} people? (${totalCount - geocodedCount} without map coordinates will be added at the end.) This will reorder the walk list for the shortest walking path.`
        : `Optimize route for ${totalCount} ${totalCount === 1 ? "person" : "people"}? This will reorder the walk list for the shortest walking path.`;

    if (!window.confirm(msg)) return;

    setLoading(true);
    const result = await optimizeRoute(listId);
    setLoading(false);

    if (result.error) {
      alert(result.error);
      return;
    }

    router.refresh();
  }

  if (totalCount === 0) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <svg className="h-4 w-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Optimizing…
        </>
      ) : (
        <>
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Optimize route
        </>
      )}
    </button>
  );
}
