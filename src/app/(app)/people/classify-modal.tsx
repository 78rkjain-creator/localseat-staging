"use client";

import { useState, useTransition } from "react";
import { classifyPerson } from "./classify-actions";

export interface UnclassifiedPerson {
  id: string;
  firstName: string;
  lastName: string;
  addressLine: string | null;
}

interface Props {
  people: UnclassifiedPerson[];
  onClose: () => void;
}

export function ClassifyModal({ people: initialPeople, onClose }: Props) {
  const [remaining, setRemaining] = useState(initialPeople);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function classify(personId: string, isOutOfDistrict: boolean) {
    setRemaining((prev) => prev.filter((p) => p.id !== personId));
    startTransition(async () => {
      const result = await classifyPerson(personId, isOutOfDistrict);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {remaining.length === 0
                ? "All classified"
                : `Classify ${remaining.length} ${remaining.length === 1 ? "person" : "people"}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mark each person as in-district or out-of-district.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-100">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Body */}
        {remaining.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-900">All done</p>
            <p className="text-sm text-slate-500 mt-1">All people have been classified.</p>
            <button
              onClick={onClose}
              className="mt-6 h-10 px-5 rounded-2xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <ul className="divide-y divide-slate-100">
              {remaining.map((person) => (
                <li key={person.id} className="flex items-center gap-3 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {person.firstName} {person.lastName}
                    </p>
                    {person.addressLine && (
                      <p className="text-sm text-slate-500 truncate">{person.addressLine}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => classify(person.id, false)}
                      disabled={isPending}
                      className="h-8 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      In district
                    </button>
                    <button
                      type="button"
                      onClick={() => classify(person.id, true)}
                      disabled={isPending}
                      className="h-8 px-3 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-xs font-semibold hover:bg-orange-100 transition-colors disabled:opacity-50"
                    >
                      Out of district
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
