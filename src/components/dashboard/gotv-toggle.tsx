"use client";

import { useState, useTransition } from "react";
import { toggleGotvMode } from "@/app/(app)/gotv/actions";

interface Props {
  enabled: boolean;
}

export function GotvToggle({ enabled }: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [optimistic, setOptimistic] = useState(enabled);

  function handleToggle() {
    if (optimistic) {
      // Turning OFF — confirm first
      setConfirming(true);
    } else {
      // Turning ON — flip immediately, then persist
      setOptimistic(true);
      startTransition(async () => {
        const result = await toggleGotvMode(true);
        if (result.error) setOptimistic(false);
      });
    }
  }

  function handleConfirmOff() {
    setConfirming(false);
    setOptimistic(false);
    startTransition(async () => {
      const result = await toggleGotvMode(false);
      if (result.error) setOptimistic(true);
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {/* Switch row */}
      <button
        type="button"
        onClick={confirming ? undefined : handleToggle}
        disabled={isPending}
        className="inline-flex items-center gap-2.5 group disabled:opacity-70"
      >
        {/* Switch track */}
        <span
          className={[
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 flex-shrink-0",
            optimistic ? "bg-emerald-500" : "bg-white/20",
          ].join(" ")}
        >
          {/* Switch knob */}
          <span
            className={[
              "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
              optimistic ? "translate-x-[22px]" : "translate-x-1",
            ].join(" ")}
          />
        </span>

        {/* Label */}
        <span
          className={[
            "text-[11px] font-semibold transition-colors",
            optimistic ? "text-emerald-300" : "text-white/50 group-hover:text-white/70",
          ].join(" ")}
        >
          {isPending
            ? optimistic ? "Activating…" : "Deactivating…"
            : optimistic ? "GOTV active" : "GOTV off"
          }
        </span>

        {/* Live pulse when active */}
        {optimistic && !isPending && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </button>

      {/* Confirmation row — only when turning off */}
      {confirming && (
        <div className="flex items-center gap-1.5 ml-[3.25rem]">
          <span className="text-[10px] text-white/40 mr-1">Deactivate?</span>
          <button
            type="button"
            onClick={handleConfirmOff}
            disabled={isPending}
            className="h-6 px-2.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {isPending ? "…" : "Yes"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-6 px-2 rounded-full text-[10px] text-white/40 hover:text-white/60 transition-colors"
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}
