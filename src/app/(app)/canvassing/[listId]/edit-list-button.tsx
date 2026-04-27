"use client";

import { useState } from "react";
import { EditListModal } from "./edit-list-modal";
import type { DynamicFilters } from "@/lib/canvassing";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  listId: string;
  currentName: string;
  isDynamic: boolean;
  currentFilters?: DynamicFilters | null;
  tags?: Tag[];
}

export function EditListButton({ listId, currentName, isDynamic, currentFilters, tags }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </button>

      <EditListModal
        open={open}
        onClose={() => setOpen(false)}
        listId={listId}
        currentName={currentName}
        isDynamic={isDynamic}
        currentFilters={currentFilters}
        tags={tags}
      />
    </>
  );
}
