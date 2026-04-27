"use client";

import { useState, useTransition } from "react";
import { removePersonFromList } from "../actions";

interface Props {
  listId: string;
  entryId: string;
  hasResponses: boolean;
}

export function RemovePersonButton({ listId, entryId, hasResponses }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (hasResponses) {
    return (
      <span
        title="Cannot remove — this person has canvass responses"
        className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-300 cursor-not-allowed"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </span>
    );
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removePersonFromList(listId, entryId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-1">
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        title="Remove from list"
        className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
