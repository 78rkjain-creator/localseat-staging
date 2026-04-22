"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  q?: string;
  tag?: string;
  supportFilter?: string;
  contactedAfter?: string;
}

export function VoterListDateFilter({ q, tag, supportFilter, contactedAfter }: Props) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function buildUrl(date: string | undefined) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    if (supportFilter) params.set("supportFilter", supportFilter);
    if (date) params.set("contactedAfter", date);
    const s = params.toString();
    return `/voter-list${s ? `?${s}` : ""}`;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) {
      router.push(buildUrl(e.target.value));
      setShowPicker(false);
    }
  }

  function handleClear() {
    router.push(buildUrl(undefined));
    setShowPicker(false);
  }

  function handleOpenPicker() {
    setShowPicker(true);
    // Focus the input after it renders
    setTimeout(() => inputRef.current?.showPicker?.(), 0);
  }

  // Active state: date is set — show formatted pill with clear button
  if (contactedAfter) {
    const formatted = new Date(contactedAfter).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    });
    return (
      <span className="inline-flex items-center gap-1.5 bg-slate-900 text-white rounded-full pl-3 pr-2 py-1.5 text-xs font-semibold">
        After {formatted}
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear date filter"
          className="flex items-center justify-center h-4 w-4 rounded-full hover:bg-white/20 transition-colors"
        >
          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    );
  }

  // Picker open: show the date input
  if (showPicker) {
    return (
      <input
        ref={inputRef}
        type="date"
        autoFocus
        onChange={handleChange}
        onBlur={() => setShowPicker(false)}
        className="h-8 rounded-xl border border-slate-200 px-3 text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
    );
  }

  // Default: empty pill trigger
  return (
    <button
      type="button"
      onClick={handleOpenPicker}
      className="bg-white border border-slate-200 text-slate-600 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
    >
      After date →
    </button>
  );
}
