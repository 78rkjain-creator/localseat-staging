"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Option {
  id: string;
  label: string;
}

function SearchSelect({
  options,
  value,
  placeholder,
  onSelect,
}: {
  options: Option[];
  value: string | null;
  placeholder: string;
  onSelect: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = value ? options.find((o) => o.id === value) : null;

  if (selected) {
    return (
      <span className="inline-flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-xl bg-brand-50 border border-brand-200 text-sm text-brand-700 font-medium">
        {selected.label}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-brand-400 hover:text-brand-600 transition-colors"
          aria-label="Clear"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    );
  }

  const filtered = options
    .filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="h-9 w-48 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-sm z-10 overflow-hidden">
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => { onSelect(o.id); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuditFilterBar({
  users,
  campaigns,
  selectedUserId,
  selectedCampaignId,
}: {
  users: Option[];
  campaigns: Option[];
  selectedUserId: string | null;
  selectedCampaignId: string | null;
}) {
  const router = useRouter();

  function navigate(userId: string | null, campaignId: string | null) {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (campaignId) params.set("campaignId", campaignId);
    params.set("page", "1");
    router.push(`/admin/audit-log?${params.toString()}`);
  }

  const hasFilters = !!(selectedUserId || selectedCampaignId);

  return (
    <div className="flex items-center gap-3 flex-wrap mb-4">
      <SearchSelect
        options={users}
        value={selectedUserId}
        placeholder="Filter by user..."
        onSelect={(id) => navigate(id, selectedCampaignId)}
      />
      <SearchSelect
        options={campaigns}
        value={selectedCampaignId}
        placeholder="Filter by campaign..."
        onSelect={(id) => navigate(selectedUserId, id)}
      />
      {hasFilters && (
        <button
          type="button"
          onClick={() => navigate(null, null)}
          className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
