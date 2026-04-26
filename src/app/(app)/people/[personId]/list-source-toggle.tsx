"use client";

import { useState, useTransition } from "react";
import { toggleIncludeInWalkLists } from "./actions";

interface Props {
  personId: string;
  initialValue: boolean;
}

export function ListSourceToggle({ personId, initialValue }: Props) {
  const [checked, setChecked] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleIncludeInWalkLists(personId);
      if (result.error) {
        setError(result.error);
      } else {
        setChecked(result.includeInWalkLists ?? !checked);
      }
    });
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-700">Include in walk lists</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Manual records are excluded by default
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={handleToggle}
          disabled={isPending}
          className={[
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            checked ? "bg-emerald-500" : "bg-slate-200",
            isPending ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              checked ? "translate-x-6" : "translate-x-1",
            ].join(" ")}
          />
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
