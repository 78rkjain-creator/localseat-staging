"use client";

import { useState, useEffect, useRef } from "react";

export interface Municipality {
  id: string;
  name: string;
  shortform?: string;
  center?: [number, number];       // [lng, lat]
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

export interface MunicipalitySelectorValue {
  id: string | null;
  name: string;
  center?: [number, number];
  bbox?: [number, number, number, number];
}

interface Props {
  value: MunicipalitySelectorValue | null;
  onChange: (value: MunicipalitySelectorValue | null) => void;
  placeholder?: string;
}

export function MunicipalitySelector({
  value,
  onChange,
  placeholder = "Search municipalities…",
}: Props) {
  const [query, setQuery] = useState("");
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [filtered, setFiltered] = useState<Municipality[]>([]);
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/data/municipalities.json")
      .then((r) => r.json())
      .then((data: Municipality[]) => setMunicipalities(data))
      .catch(() => setMunicipalities([]));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(municipalities.slice(0, 8));
    } else {
      const q = query.toLowerCase();
      setFiltered(
        municipalities
          .filter(
            (m) =>
              m.name.toLowerCase().includes(q) ||
              (m.shortform ?? "").toLowerCase().includes(q)
          )
          .slice(0, 8)
      );
    }
  }, [query, municipalities]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectMunicipality(m: Municipality) {
    onChange({ id: m.id, name: m.name, center: m.center, bbox: m.bbox });
    setQuery("");
    setOpen(false);
    setCustomMode(false);
  }

  function enterCustomMode() {
    setCustomMode(true);
    setOpen(false);
    setQuery("");
  }

  function confirmCustom() {
    const trimmed = customName.trim();
    if (!trimmed) return;
    onChange({ id: null, name: trimmed });
    setCustomMode(false);
    setCustomName("");
  }

  function clear() {
    onChange(null);
    setCustomMode(false);
    setCustomName("");
    setQuery("");
  }

  // ── Selected state ────────────────────────────────────────────────────────

  if (value && !customMode) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2.5 min-w-0 flex-1">
          <svg className="h-4 w-4 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497z"
            />
          </svg>
          <span className="text-sm font-semibold text-brand-700 truncate">{value.name}</span>
          {!value.id && (
            <span className="text-[10px] font-semibold text-brand-400 uppercase tracking-wide flex-shrink-0">
              custom
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors flex-shrink-0 py-2.5"
        >
          Change
        </button>
      </div>
    );
  }

  // ── Custom entry mode ─────────────────────────────────────────────────────

  if (customMode) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmCustom();
            }
          }}
          placeholder="Enter municipality name…"
          className="h-11 flex-1 min-w-0 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={confirmCustom}
          className="h-11 px-4 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
        >
          Set
        </button>
        <button
          type="button"
          onClick={() => setCustomMode(false)}
          className="h-11 px-3 text-slate-500 hover:text-slate-700 text-sm rounded-xl border border-slate-200 transition-colors flex-shrink-0"
        >
          Cancel
        </button>
      </div>
    );
  }

  // ── Dropdown search mode ──────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.length > 0 ? (
            <ul className="py-1 max-h-56 overflow-y-auto overscroll-contain">
              {filtered.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectMunicipality(m);
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-50 transition-colors"
                  >
                    {m.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-slate-400">No municipalities found.</p>
          )}

          <div className="border-t border-slate-100 px-3 py-2.5">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                enterCustomMode();
              }}
              className="w-full text-left text-sm text-slate-500 hover:text-brand-600 py-1 transition-colors"
            >
              My municipality isn&apos;t listed →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
