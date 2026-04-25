"use client";

import { useState } from "react";
import { AddSignForm } from "./add-sign-form";

export function AddSignButton() {
  const [open, setOpen] = useState(false);

  if (open) {
    return <AddSignForm onCancel={() => setOpen(false)} />;
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="h-9 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors inline-flex items-center gap-1.5"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      Add sign
    </button>
  );
}
