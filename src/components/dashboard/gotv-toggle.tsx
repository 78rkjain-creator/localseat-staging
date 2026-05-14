"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleGotvMode } from "@/app/(app)/gotv/actions";

interface Props {
  enabled: boolean;
}

export function GotvToggle({ enabled }: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [optimistic, setOptimistic] = useState(enabled);

  function handleClick() {
    if (optimistic) {
      // Turning OFF — confirm first
      setConfirming(true);
    } else {
      // Turning ON — go straight to GOTV setup page for target config
      // (handled by the Link below)
    }
  }

  function handleConfirmOff() {
    setConfirming(false);
    startTransition(async () => {
      setOptimistic(false);
      await toggleGotvMode(false);
    });
  }

  // When GOTV is off, the toggle links to the setup page
  if (!optimistic) {
    return (
      <Link
        href="/gotv"
        className="mt-2 inline-flex items-center gap-2 h-8 pl-2.5 pr-3 rounded-full text-[11px] font-semibold bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80 transition-colors"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
        Activate GOTV
      </Link>
    );
  }

  // When GOTV is on — show live badge + toggle off control
  return (
    <div className="mt-2 flex items-center gap-2">
      <Link
        href="/gotv"
        className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        GOTV active
      </Link>

      {/* Toggle off button */}
      {!confirming ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className="h-8 px-2.5 rounded-full text-[11px] font-medium text-white/40 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          title="Deactivate GOTV mode"
        >
          {isPending ? "…" : "Turn off"}
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleConfirmOff}
            disabled={isPending}
            className="h-7 px-2.5 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {isPending ? "Turning off…" : "Confirm off"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-7 px-2 rounded-full text-[11px] text-white/40 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
