"use client";

import { useState, useRef, useEffect } from "react";

export interface TagData {
  id: string;
  name: string;
  color: string | null;
}

export const TAG_PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7",
];

interface TagPickerProps {
  campaignTags: TagData[];
  appliedTagIds: Set<string>;
  onSelect: (tag: TagData) => void;
  disabled?: boolean;
}

export function TagPicker({
  campaignTags,
  appliedTagIds,
  onSelect,
  disabled = false,
}: TagPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unapplied = campaignTags.filter(
    (t) => !appliedTagIds.has(t.id) && t.name.toLowerCase().includes(query.toLowerCase())
  );

  function handleSelect(tag: TagData) {
    onSelect(tag);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, unapplied.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < unapplied.length) {
        handleSelect(unapplied[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Add tag…"
        disabled={disabled}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
      />

      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {unapplied.map((tag, i) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleSelect(tag)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 border-b border-slate-100 last:border-b-0 ${
                  activeIndex === i ? "bg-slate-50" : "hover:bg-slate-50"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color ?? "#94a3b8" }}
                />
                <span className="text-xs text-slate-700">{tag.name}</span>
              </button>
            ))}

            {unapplied.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">
                {query.trim() ? "No match." : "All tags applied."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
