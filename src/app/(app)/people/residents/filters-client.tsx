"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ListSource } from "@/types";
import { LIST_SOURCE_LABELS } from "@/types";

const RESIDENTS_LIST_SOURCE_VALUES: ListSource[] = [
  "voters_list",
  "residents_list",
  "manual",
  "canvass",
];

interface Props {
  q?: string;
  tag?: string;
  supportFilter?: string;
  contactedAfter?: string;
  cfFilters?: string;
  listSource?: string;
}

interface ListSourceFilterProps {
  activeListSources: ListSource[];
  q?: string;
  tag?: string;
  supportFilter?: string;
  contactedAfter?: string;
  cfFilters?: string;
}

export function ResidentsListSourceFilter({
  activeListSources,
  q,
  tag,
  supportFilter,
  contactedAfter,
  cfFilters,
}: ListSourceFilterProps) {
  const router = useRouter();
  const allSelected =
    activeListSources.length === 0 ||
    activeListSources.length === RESIDENTS_LIST_SOURCE_VALUES.length;

  function buildUrl(sources: ListSource[]) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    if (supportFilter) params.set("supportFilter", supportFilter);
    if (contactedAfter) params.set("contactedAfter", contactedAfter);
    if (cfFilters) params.set("cfFilters", cfFilters);
    if (sources.length > 0 && sources.length < RESIDENTS_LIST_SOURCE_VALUES.length) {
      params.set("listSource", sources.join(","));
    }
    const s = params.toString();
    return `/people/residents${s ? `?${s}` : ""}`;
  }

  function toggle(value: ListSource) {
    const current = allSelected ? RESIDENTS_LIST_SOURCE_VALUES : activeListSources;
    const next = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value];
    router.push(buildUrl(next.length === RESIDENTS_LIST_SOURCE_VALUES.length ? [] : next));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-400 font-medium">Source:</span>
      {RESIDENTS_LIST_SOURCE_VALUES.map((value) => {
        const isActive = allSelected || activeListSources.includes(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className={
              isActive
                ? "bg-slate-900 text-white rounded-full px-3 py-1.5 text-xs font-semibold"
                : "bg-white border border-slate-200 text-slate-400 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
            }
          >
            {LIST_SOURCE_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}

export function ResidentsDateFilter({
  q,
  tag,
  supportFilter,
  contactedAfter,
  cfFilters,
  listSource,
}: Props) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function buildUrl(date: string | undefined) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    if (supportFilter) params.set("supportFilter", supportFilter);
    if (date) params.set("contactedAfter", date);
    if (cfFilters) params.set("cfFilters", cfFilters);
    if (listSource) params.set("listSource", listSource);
    const s = params.toString();
    return `/people/residents${s ? `?${s}` : ""}`;
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
    setTimeout(() => inputRef.current?.showPicker?.(), 0);
  }

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
          <svg
            className="h-2.5 w-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    );
  }

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
