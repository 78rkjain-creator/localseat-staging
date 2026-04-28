"use client";

import { useState, useTransition } from "react";
import { anonymizePerson } from "./anonymize-actions";

interface Props {
  personId: string;
  personName: string;
}

export function AnonymizeButton({ personId, personName }: Props) {
  const [showDialog, setShowDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await anonymizePerson(personId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setShowDialog(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDialog(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        Anonymize
      </button>

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { if (!isPending) setShowDialog(false); }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Anonymize this record?</h2>
                <p className="text-sm text-slate-500 mt-0.5">{personName}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-3 leading-relaxed">
              The following will be permanently replaced with anonymous placeholders:
            </p>
            <ul className="text-sm text-slate-600 mb-4 space-y-1 pl-1">
              {[
                'Name → "Anonymized Record"',
                "Phone numbers",
                "Email address",
                "Date of birth",
                "Custom field values",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Canvass history and support levels are kept for statistical purposes. This cannot be undone.
            </p>

            {error && (
              <p className="text-xs text-red-500 mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {isPending ? "Anonymizing…" : "Yes, anonymize"}
              </button>
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                disabled={isPending}
                className="flex-1 h-10 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
