"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveList, unarchiveList, deleteList } from "../actions";

interface Props {
  listId: string;
  listName: string;
  isArchived: boolean;
  canDelete: boolean;
}

export function ArchiveDeleteButtons({ listId, listName, isArchived, canDelete }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    setError(null);
    startTransition(async () => {
      const result = isArchived ? await unarchiveList(listId) : await archiveList(listId);
      if (result?.error) setError(result.error);
    });
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteList(listId);
      if (result?.error) {
        setError(result.error);
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <p className="text-xs text-red-600 max-w-xs text-right">{error}</p>
      )}

      <button
        type="button"
        onClick={handleArchive}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
      >
        {isArchived ? (
          <>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Unarchive
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Archive
          </>
        )}
      </button>

      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className={[
            "inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50",
            confirmDelete
              ? "bg-red-600 border-red-600 text-white hover:bg-red-700"
              : "border-slate-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-200",
          ].join(" ")}
          onBlur={() => setConfirmDelete(false)}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {confirmDelete ? "Confirm delete" : "Delete"}
        </button>
      )}
    </div>
  );
}
