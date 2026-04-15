"use client";

import { useEffect, useState, useRef } from "react";

interface Props {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
}

/**
 * Displays sync state at the top of the canvassing screen.
 * Renders nothing when online and queue is empty.
 * Uses flex-none so it sits above the fixed-height canvass layout without
 * disrupting the header/main/footer structure.
 */
export function SyncStatusBar({ pendingCount, isSyncing, lastSyncedAt }: Props) {
  // Brief "all synced" confirmation after queue drains to zero.
  const [showSynced, setShowSynced] = useState(false);
  // Track previous pendingCount so we only flash "synced" when it actually dropped.
  const prevPendingRef = useRef(pendingCount);

  useEffect(() => {
    prevPendingRef.current = pendingCount;
  });

  useEffect(() => {
    if (!isSyncing && pendingCount === 0 && lastSyncedAt !== null) {
      setShowSynced(true);
      const t = setTimeout(() => setShowSynced(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isSyncing, pendingCount, lastSyncedAt]);

  // Nothing to show: online, queue empty, no recent sync confirmation.
  if (!isSyncing && pendingCount === 0 && !showSynced) return null;

  if (showSynced) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex-none bg-emerald-50 border-b border-emerald-200 px-4 py-1.5 flex items-center gap-2"
      >
        <svg
          className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-xs font-medium text-emerald-700">All responses synced</p>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex-none bg-slate-100 border-b border-slate-200 px-4 py-1.5 flex items-center gap-2"
      >
        <svg
          className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-xs font-medium text-slate-600">
          Syncing {pendingCount} response{pendingCount !== 1 ? "s" : ""}…
        </p>
      </div>
    );
  }

  // Pending items, not currently syncing (offline or waiting for next attempt).
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex-none bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center gap-2"
    >
      <svg
        className="h-3.5 w-3.5 text-amber-500 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="text-xs font-medium text-amber-800">
        {pendingCount} saved locally — will sync when connection returns
      </p>
    </div>
  );
}
