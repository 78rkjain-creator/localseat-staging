"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { addSign, searchAddressesForSigns } from "./actions";

type LocationType = "residential" | "non_residential";
type SignStatus = "to_be_installed" | "installed";

export function AddSignForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [locationType, setLocationType] = useState<LocationType>("residential");
  const [status, setStatus] = useState<SignStatus>("to_be_installed");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Residential — address search
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<{ id: string; label: string }[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<{ id: string; label: string } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Non-residential
  const [locationText, setLocationText] = useState("");

  useEffect(() => {
    if (locationType !== "residential" || addressQuery.length < 2) {
      setAddressResults([]);
      setShowDropdown(false);
      return;
    }
    const t = setTimeout(async () => {
      const results = await searchAddressesForSigns(addressQuery);
      setAddressResults(results);
      setShowDropdown(results.length > 0);
    }, 200);
    return () => clearTimeout(t);
  }, [addressQuery, locationType]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const result = await addSign({
      locationType,
      addressId: locationType === "residential" ? selectedAddress?.id : null,
      locationText: locationType === "non_residential" ? locationText : null,
      status,
      notes: notes || null,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
      onCancel();
    }
  }

  const inputCls = "w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500";
  const toggleBtn = (active: boolean) =>
    [
      "flex-1 h-9 rounded-xl text-sm font-medium transition-colors border",
      active
        ? "bg-brand-500 text-white border-brand-500"
        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
    ].join(" ");

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 px-5 py-4 mb-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Add sign</h3>

      {/* Location type toggle */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 mb-1.5">Location type</p>
        <div className="flex gap-2">
          <button type="button" className={toggleBtn(locationType === "residential")} onClick={() => { setLocationType("residential"); setSelectedAddress(null); setAddressQuery(""); }}>
            Residential
          </button>
          <button type="button" className={toggleBtn(locationType === "non_residential")} onClick={() => { setLocationType("non_residential"); }}>
            Non-residential
          </button>
        </div>
      </div>

      {/* Location input */}
      {locationType === "residential" ? (
        <div className="mb-4 relative" ref={searchRef}>
          <p className="text-xs font-medium text-slate-500 mb-1.5">Address</p>
          {selectedAddress ? (
            <div className="flex items-center gap-2 h-9 px-3 rounded-xl border border-brand-200 bg-brand-50 text-sm text-brand-800">
              <span className="flex-1 truncate">{selectedAddress.label}</span>
              <button type="button" onClick={() => { setSelectedAddress(null); setAddressQuery(""); }} className="text-brand-500 hover:text-brand-700 flex-shrink-0">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ) : (
            <input
              type="text"
              className={inputCls}
              placeholder="Search by street name…"
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              onFocus={() => addressResults.length > 0 && setShowDropdown(true)}
            />
          )}
          {showDropdown && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {addressResults.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => { setSelectedAddress(a); setAddressQuery(""); setShowDropdown(false); }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 mb-1.5">Location description</p>
          <input
            type="text"
            className={inputCls}
            placeholder="e.g. Corner of 10th St E and Highway 26"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            maxLength={500}
          />
        </div>
      )}

      {/* Status */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 mb-1.5">Status</p>
        <div className="flex gap-2">
          <button type="button" className={toggleBtn(status === "to_be_installed")} onClick={() => setStatus("to_be_installed")}>
            To be installed
          </button>
          <button type="button" className={toggleBtn(status === "installed")} onClick={() => setStatus("installed")}>
            Installed
          </button>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 mb-1.5">Notes <span className="text-slate-400">(optional)</span></p>
        <textarea
          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="h-9 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="h-9 px-4 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
