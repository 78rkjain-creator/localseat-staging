"use client";

import { useTransition } from "react";
import { toggleDoNotContact } from "./anonymize-actions";

interface Props {
  personId: string;
  doNotContact: boolean;
}

export function DoNotContactToggle({ personId, doNotContact }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleDoNotContact(personId, !doNotContact);
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className={[
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border text-xs font-medium transition-colors disabled:opacity-50",
        doNotContact
          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-slate-200 text-slate-500 hover:bg-slate-50",
      ].join(" ")}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
      {isPending
        ? "Saving…"
        : doNotContact
          ? "Do not contact"
          : "Mark do not contact"}
    </button>
  );
}
