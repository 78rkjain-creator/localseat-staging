"use client";

import { useState, useEffect, useRef } from "react";

export interface AddressValue {
  addressId?: string;
  streetNumber?: string;
  streetName?: string;
  unitNumber?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

interface AddressResult {
  id: string;
  streetNumber: string;
  streetName: string;
  unitNumber: string | null;
  city: string;
  province: string;
  postalCode: string;
}

export function addressValueComplete(v: AddressValue | null): boolean {
  if (!v) return false;
  if (v.addressId) return true;
  return !!(v.streetNumber?.trim() && v.streetName?.trim() && v.city?.trim() && v.postalCode?.trim());
}

function fmt(addr: AddressResult): string {
  let s = `${addr.streetNumber} ${addr.streetName}`;
  if (addr.unitNumber) s += ` #${addr.unitNumber}`;
  return `${s}, ${addr.city} ${addr.postalCode}`;
}

const inp =
  "w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500";

interface AddressPickerProps {
  onChange: (v: AddressValue | null) => void;
  compact?: boolean;
}

export function AddressPicker({ onChange, compact = false }: AddressPickerProps) {
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [selected, setSelected] = useState<AddressResult | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Manual mode fields
  const [sn, setSn] = useState("");
  const [st, setSt] = useState("");
  const [un, setUn] = useState("");
  const [ci, setCi] = useState("");
  const [pr, setPr] = useState("ON");
  const [pc, setPc] = useState("");

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (mode !== "search" || query.length < 2) {
      setResults([]);
      setShowDrop(false);
      return;
    }
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/addresses/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = (await res.json()) as AddressResult[];
          setResults(data);
          setShowDrop(data.length > 0);
        }
      } catch { /* ignore */ }
    }, 250);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [mode, query]);

  function handleSelect(addr: AddressResult) {
    setSelected(addr);
    setQuery(fmt(addr));
    setShowDrop(false);
    onChange({ addressId: addr.id });
  }

  function handleQueryChange(val: string) {
    setQuery(val);
    if (!val || (selected && fmt(selected) !== val)) {
      setSelected(null);
      onChange(null);
    }
  }

  function switchToManual() {
    setMode("manual");
    setQuery("");
    setSelected(null);
    setSn(""); setSt(""); setUn(""); setCi(""); setPr("ON"); setPc("");
    onChange(null);
  }

  function switchToSearch() {
    setMode("search");
    onChange(null);
  }

  function notifyManual(fields: { sn: string; st: string; un: string; ci: string; pr: string; pc: string }) {
    if (fields.sn.trim() && fields.st.trim() && fields.ci.trim() && fields.pc.trim()) {
      onChange({
        streetNumber: fields.sn.trim(),
        streetName: fields.st.trim(),
        unitNumber: fields.un.trim() || undefined,
        city: fields.ci.trim(),
        province: fields.pr.trim() || "ON",
        postalCode: fields.pc.trim(),
      });
    } else {
      onChange(null);
    }
  }

  if (mode === "manual" && !compact) {
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Street no. <span className="text-red-400">*</span></span>
            <input
              value={sn}
              onChange={e => { setSn(e.target.value); notifyManual({ sn: e.target.value, st, un, ci, pr, pc }); }}
              className={inp}
              placeholder="123"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Street name <span className="text-red-400">*</span></span>
            <input
              value={st}
              onChange={e => { setSt(e.target.value); notifyManual({ sn, st: e.target.value, un, ci, pr, pc }); }}
              className={inp}
              placeholder="Main St"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Unit</span>
            <input
              value={un}
              onChange={e => { setUn(e.target.value); notifyManual({ sn, st, un: e.target.value, ci, pr, pc }); }}
              className={inp}
              placeholder="Apt 4"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">City <span className="text-red-400">*</span></span>
            <input
              value={ci}
              onChange={e => { setCi(e.target.value); notifyManual({ sn, st, un, ci: e.target.value, pr, pc }); }}
              className={inp}
              placeholder="Toronto"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Province</span>
            <input
              value={pr}
              onChange={e => { setPr(e.target.value); notifyManual({ sn, st, un, ci, pr: e.target.value, pc }); }}
              className={inp}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Postal code <span className="text-red-400">*</span></span>
            <input
              value={pc}
              onChange={e => { setPc(e.target.value); notifyManual({ sn, st, un, ci, pr, pc: e.target.value }); }}
              className={inp}
              placeholder="M5V 2T6"
            />
          </label>
        </div>
        <button type="button" onClick={switchToSearch} className="text-xs text-brand-600 hover:underline text-left">
          ← Search existing addresses
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropRef}>
      <input
        value={query}
        onChange={e => handleQueryChange(e.target.value)}
        className={inp}
        placeholder="Start typing an address…"
        autoComplete="off"
      />
      {showDrop && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
          {results.map(addr => (
            <button
              key={addr.id}
              type="button"
              onClick={() => handleSelect(addr)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-brand-50 transition-colors"
            >
              <span className="font-medium text-slate-900">{addr.streetNumber} {addr.streetName}</span>
              {addr.unitNumber && <span className="text-slate-500"> #{addr.unitNumber}</span>}
              <span className="text-slate-500">, {addr.city}</span>
            </button>
          ))}
        </div>
      )}
      {!compact && (
        <button type="button" onClick={switchToManual} className="text-xs text-brand-600 hover:underline mt-1.5 block">
          Can&apos;t find it? Enter manually →
        </button>
      )}
    </div>
  );
}
