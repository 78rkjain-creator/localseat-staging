"use client";

import { Printer } from "lucide-react";

export function PrintButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : () => window.print()}
      disabled={disabled}
      title={disabled ? "Add people to this list to enable this action" : undefined}
      className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Printer className="h-4 w-4 text-slate-400" />
      Print list
    </button>
  );
}
