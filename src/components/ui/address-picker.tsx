"use client";

import { useState, useEffect, useRef } from "react";
import type { AddressSearchResponse, CampaignAddress, MapboxSuggestion, NarSuggestion } from "@/app/api/addresses/search/route";

// ── Exported types ─────────────────────────────────────────────────────────────

export interface AddressValue {
  addressId?: string;
  streetNumber?: string;
  streetName?: string;
  unitNumber?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}

export type AddressPickerResult =
  | ({ type: "campaign" } & CampaignAddress)
  | ({ type: "nar" } & NarSuggestion)
  | ({ type: "mapbox" } & MapboxSuggestion)
  | { type: "manual"; streetNumber: string; streetName: string; unitNumber?: string; city: string; province: string; postalCode: string };

export function addressValueComplete(v: AddressValue | null): boolean {
  if (!v) return false;
  if (v.addressId) return true;
  return !!(v.streetNumber?.trim() && v.streetName?.trim() && v.city?.trim() && v.postalCode?.trim());
}

// ── Internals ──────────────────────────────────────────────────────────────────

const inp =
  "w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500";

const sectionHeader =
  "px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400 select-none pointer-events-none";

// ── Component ──────────────────────────────────────────────────────────────────

interface AddressPickerProps {
  onSelect: (result: AddressPickerResult | null) => void;
  compact?: boolean;
}

export function AddressPicker({ onSelect, compact = false }: AddressPickerProps) {
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<AddressSearchResponse | null>(null);
  const [showDrop, setShowDrop] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);

  const cacheRef = useRef<Map<string, AddressSearchResponse>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Manual mode field state
  const [sn, setSn] = useState("");
  const [st, setSt] = useState("");
  const [un, setUn] = useState("");
  const [ci, setCi] = useState("");
  const [pr, setPr] = useState("ON");
  const [pc, setPc] = useState("");

  const campaignItems = response?.campaign ?? [];
  const narItems = response?.nar ?? [];
  const mapboxItems = response?.mapbox ?? [];
  const totalItems = campaignItems.length + narItems.length + mapboxItems.length;

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced fetch with abort + session cache
  useEffect(() => {
    if (mode !== "search" || query.length < 3) {
      setResponse(null);
      setShowDrop(false);
      setActiveIdx(-1);
      return;
    }

    const cached = cacheRef.current.get(query);
    if (cached) {
      setResponse(cached);
      setShowDrop(cached.campaign.length > 0 || cached.nar.length > 0 || cached.mapbox.length > 0);
      setActiveIdx(-1);
      return;
    }

    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      fetch(`/api/addresses/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then(r => (r.ok ? (r.json() as Promise<AddressSearchResponse>) : null))
        .then(data => {
          if (!data) return;
          cacheRef.current.set(query, data);
          setResponse(data);
          setShowDrop(data.campaign.length > 0 || data.nar.length > 0 || data.mapbox.length > 0);
          setActiveIdx(-1);
        })
        .catch(err => {
          if ((err as Error)?.name !== "AbortError") {
            console.warn("[AddressPicker] fetch error:", err);
          }
        });
    }, 300);

    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [mode, query]);

  function pickCampaign(addr: CampaignAddress) {
    const label = `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}, ${addr.city}`;
    setQuery(label);
    setPickedLabel(label);
    setShowDrop(false);
    setActiveIdx(-1);
    onSelect({ type: "campaign", ...addr });
  }

  function pickMapbox(addr: MapboxSuggestion) {
    setQuery(addr.displayAddress);
    setPickedLabel(addr.displayAddress);
    setShowDrop(false);
    setActiveIdx(-1);
    onSelect({ type: "mapbox", ...addr });
  }

  function pickNar(addr: NarSuggestion) {
    setQuery(addr.displayAddress);
    setPickedLabel(addr.displayAddress);
    setShowDrop(false);
    setActiveIdx(-1);
    onSelect({ type: "nar", ...addr });
  }

  function handleQueryChange(val: string) {
    setQuery(val);
    if (pickedLabel !== null && val !== pickedLabel) {
      setPickedLabel(null);
      onSelect(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDrop || totalItems === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      if (activeIdx < campaignItems.length) {
        pickCampaign(campaignItems[activeIdx]!);
      } else if (activeIdx < campaignItems.length + narItems.length) {
        pickNar(narItems[activeIdx - campaignItems.length]!);
      } else {
        pickMapbox(mapboxItems[activeIdx - campaignItems.length - narItems.length]!);
      }
    } else if (e.key === "Escape") {
      setShowDrop(false);
      setActiveIdx(-1);
    }
  }

  function switchToManual() {
    setMode("manual");
    setQuery("");
    setPickedLabel(null);
    setSn(""); setSt(""); setUn(""); setCi(""); setPr("ON"); setPc("");
    onSelect(null);
  }

  function switchToSearch() {
    setMode("search");
    onSelect(null);
  }

  function notifyManual(fields: { sn: string; st: string; un: string; ci: string; pr: string; pc: string }) {
    if (fields.sn.trim() && fields.st.trim() && fields.ci.trim() && fields.pc.trim()) {
      onSelect({
        type: "manual",
        streetNumber: fields.sn.trim(),
        streetName: fields.st.trim(),
        unitNumber: fields.un.trim() || undefined,
        city: fields.ci.trim(),
        province: fields.pr.trim() || "ON",
        postalCode: fields.pc.trim(),
      });
    } else {
      onSelect(null);
    }
  }

  // ── Manual mode ───────────────────────────────────────────────────────────────

  if (mode === "manual" && !compact) {
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Street no. <span className="text-red-400">*</span></span>
            <input value={sn} onChange={e => { setSn(e.target.value); notifyManual({ sn: e.target.value, st, un, ci, pr, pc }); }} className={inp} placeholder="123" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Street name <span className="text-red-400">*</span></span>
            <input value={st} onChange={e => { setSt(e.target.value); notifyManual({ sn, st: e.target.value, un, ci, pr, pc }); }} className={inp} placeholder="Main St" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Unit</span>
            <input value={un} onChange={e => { setUn(e.target.value); notifyManual({ sn, st, un: e.target.value, ci, pr, pc }); }} className={inp} placeholder="Apt 4" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">City <span className="text-red-400">*</span></span>
            <input value={ci} onChange={e => { setCi(e.target.value); notifyManual({ sn, st, un, ci: e.target.value, pr, pc }); }} className={inp} placeholder="Toronto" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Province</span>
            <input value={pr} onChange={e => { setPr(e.target.value); notifyManual({ sn, st, un, ci, pr: e.target.value, pc }); }} className={inp} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Postal code <span className="text-red-400">*</span></span>
            <input value={pc} onChange={e => { setPc(e.target.value); notifyManual({ sn, st, un, ci, pr, pc: e.target.value }); }} className={inp} placeholder="M5V 2T6" />
          </label>
        </div>
        <button type="button" onClick={switchToSearch} className="text-xs text-brand-600 hover:underline text-left">
          ← Search existing addresses
        </button>
      </div>
    );
  }

  // ── Search mode ───────────────────────────────────────────────────────────────

  const hasCampaign = campaignItems.length > 0;
  const hasNar = narItems.length > 0;
  const hasMapbox = mapboxItems.length > 0;

  return (
    <div className="relative" ref={wrapRef}>
      <input
        value={query}
        onChange={e => handleQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={inp}
        placeholder="Start typing an address…"
        autoComplete="off"
      />

      {showDrop && (hasCampaign || hasNar || hasMapbox) && (
        <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">

          {hasCampaign && (
            <>
              <div className={sectionHeader}>In this campaign</div>
              {campaignItems.map((addr, i) => (
                <button
                  key={addr.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); pickCampaign(addr); }}
                  className={`w-full text-left px-3 py-2 transition-colors ${activeIdx === i ? "bg-brand-50" : "hover:bg-slate-50"}`}
                >
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {addr.streetNumber} {addr.streetName}{addr.unitNumber ? ` #${addr.unitNumber}` : ""}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {addr.city} · {addr.residentCount === 1 ? "1 resident" : `${addr.residentCount} residents`}
                  </p>
                </button>
              ))}
            </>
          )}

          {hasNar && (
            <>
              <div className={`${sectionHeader}${hasCampaign ? " border-t border-slate-100 mt-1" : ""}`}>
                Canadian addresses
              </div>
              {narItems.map((addr, i) => {
                const flatIdx = campaignItems.length + i;
                const streetLine = addr.streetNumber
                  ? `${addr.streetNumber} ${addr.streetName}`
                  : addr.streetName;
                const secondary = [addr.city, addr.province, addr.postalCode].filter(Boolean).join(", ");
                return (
                  <button
                    key={`nar-${i}`}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); pickNar(addr); }}
                    className={`w-full text-left px-3 py-2 transition-colors ${activeIdx === flatIdx ? "bg-brand-50" : "hover:bg-slate-50"}`}
                  >
                    <p className="text-sm font-medium text-slate-900 truncate">{streetLine}</p>
                    <p className="text-xs text-slate-400 truncate">{secondary}</p>
                  </button>
                );
              })}
            </>
          )}

          {hasMapbox && (
            <>
              <div className={`${sectionHeader}${(hasCampaign || hasNar) ? " border-t border-slate-100 mt-1" : ""}`}>
                Search anywhere
              </div>
              {mapboxItems.map((addr, i) => {
                const flatIdx = campaignItems.length + narItems.length + i;
                const streetLine = addr.streetNumber
                  ? `${addr.streetNumber} ${addr.streetName}`
                  : addr.streetName;
                const secondary = [addr.city, addr.province, addr.postalCode].filter(Boolean).join(", ");
                return (
                  <button
                    key={`mb-${i}`}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); pickMapbox(addr); }}
                    className={`w-full text-left px-3 py-2 transition-colors ${activeIdx === flatIdx ? "bg-brand-50" : "hover:bg-slate-50"}`}
                  >
                    <p className="text-sm font-medium text-slate-900 truncate">{streetLine}</p>
                    <p className="text-xs text-slate-400 truncate">{secondary}</p>
                  </button>
                );
              })}
            </>
          )}

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
