"use client";

import { useRef, useState, useEffect } from "react";
import { AuditLogTable, type AuditEntry } from "@/components/audit-log/audit-log-table";

interface UserOption {
  id: string;
  label: string;
}

function UserFilter({
  users,
  value,
  onSelect,
}: {
  users: UserOption[];
  value: string | null;
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

  const selected = value ? users.find((u) => u.id === value) : null;

  if (selected) {
    return (
      <span className="inline-flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-xl bg-brand-50 border border-brand-200 text-sm text-brand-700 font-medium">
        {selected.label}
        <button
          type="button"
          onClick={() => { onSelect(null); }}
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

  const filtered = users
    .filter((u) => u.label.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Filter by user..."
        className="h-9 w-48 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl border border-slate-200 shadow-sm z-10 overflow-hidden">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => { onSelect(u.id); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {u.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuditLogClient({
  entries,
  users,
  total,
  truncated,
}: {
  entries: AuditEntry[];
  users: UserOption[];
  total: number;
  truncated: boolean;
}) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const filtered = selectedUserId
    ? entries.filter((e) => e.userId === selectedUserId)
    : entries;

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap mb-4">
        {users.length > 1 && (
          <UserFilter users={users} value={selectedUserId} onSelect={setSelectedUserId} />
        )}
        <p className="text-xs text-slate-400 ml-auto">
          {selectedUserId
            ? `Showing ${filtered.length} of ${entries.length} entries`
            : truncated
            ? `Showing most recent ${entries.length} of ${total.toLocaleString()} entries`
            : `${total.toLocaleString()} entr${total !== 1 ? "ies" : "y"}`}
        </p>
      </div>
      <AuditLogTable entries={filtered} showCampaign={false} />
    </>
  );
}
