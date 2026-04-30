"use client";

import { useState, useTransition } from "react";
import { requestOutOfDistrictMark, removeOutOfDistrict } from "./out-of-district-actions";

interface Props {
  personId: string;
  isOutOfDistrict: boolean;
  canMark: boolean;
  canRemove: boolean;
}

export function OutOfDistrictControl({ personId, isOutOfDistrict, canMark, canRemove }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  if (isOutOfDistrict) {
    return (
      <div className="pt-3 mt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
            Out of District
            {canRemove && (
              <button
                type="button"
                onClick={() => run(() => removeOutOfDistrict(personId))}
                disabled={isPending}
                aria-label="Remove out-of-district mark"
                className="h-3.5 w-3.5 flex items-center justify-center rounded-full text-orange-500 hover:text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        </div>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (!canMark) return null;

  return (
    <div className="pt-3 mt-3 border-t border-slate-100">
      <button
        type="button"
        onClick={() => run(() => requestOutOfDistrictMark(personId))}
        disabled={isPending}
        className="h-7 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Mark out of district"}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
