"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { addResident } from "./actions";
import { TagPicker } from "@/components/ui/tag-picker";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";

interface Tag {
  id: string;
  name: string;
  color: string | null;
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

function formatAddress(addr: AddressResult): string {
  let line = `${addr.streetNumber} ${addr.streetName}`;
  if (addr.unitNumber) line += ` #${addr.unitNumber}`;
  return `${line}, ${addr.city} ${addr.postalCode}`;
}

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

export function AddResidentForm({ tags }: { tags: Tag[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Name
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Address mode
  const [addressMode, setAddressMode] = useState<"search" | "manual">("search");

  // Address search
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<AddressResult[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // New address fields
  const [streetNumber, setStreetNumber] = useState("");
  const [streetName, setStreetName] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("ON");
  const [postalCode, setPostalCode] = useState("");

  // Shared unit field (applies in both modes)
  const [unitNumber, setUnitNumber] = useState("");

  // Contact
  const [phoneHome, setPhoneHome] = useState("");
  const [phoneMobile, setPhoneMobile] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");

  // Notes + tags
  const [notes, setNotes] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced address search
  useEffect(() => {
    if (addressQuery.length < 2) {
      setAddressResults([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/addresses/search?q=${encodeURIComponent(addressQuery)}`);
        if (res.ok) {
          const data = (await res.json()) as AddressResult[];
          setAddressResults(data);
          setShowDropdown(data.length > 0);
        }
      } catch {
        // silently ignore fetch errors in the combobox
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [addressQuery]);

  function handleAddressSelect(addr: AddressResult) {
    setSelectedAddress(addr);
    setAddressQuery(formatAddress(addr));
    setShowDropdown(false);
  }

  function switchToManual() {
    setAddressMode("manual");
    setSelectedAddress(null);
    setAddressQuery("");
    setAddressResults([]);
  }

  function switchToSearch() {
    setAddressMode("search");
    setStreetNumber("");
    setStreetName("");
    setCity("");
    setPostalCode("");
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addResident({
        firstName,
        lastName,
        addressId: addressMode === "search" ? (selectedAddress?.id ?? undefined) : undefined,
        streetNumber: addressMode === "manual" ? streetNumber : undefined,
        streetName: addressMode === "manual" ? streetName : undefined,
        unitNumber: unitNumber || undefined,
        city: addressMode === "manual" ? city : undefined,
        province: addressMode === "manual" ? province : undefined,
        postalCode: addressMode === "manual" ? postalCode : undefined,
        phoneHome: phoneHome || undefined,
        phoneMobile: phoneMobile || undefined,
        email: email || undefined,
        birthDate: birthDate || undefined,
        notes: notes || undefined,
        tagIds: selectedTagIds,
      });
      if (result?.error) setError(result.error);
      // On success the server action redirects — nothing to handle here
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Name ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-5 space-y-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>
              First name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
              placeholder="Jane"
              required
              disabled={isPending}
            />
          </div>
          <div>
            <label className={labelClass}>
              Last name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
              placeholder="Smith"
              required
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      {/* ── Address ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Address</h2>
          {addressMode === "search" ? (
            <button
              type="button"
              onClick={switchToManual}
              className="text-xs text-brand-500 hover:text-brand-600 font-medium"
            >
              Enter manually
            </button>
          ) : (
            <button
              type="button"
              onClick={switchToSearch}
              className="text-xs text-brand-500 hover:text-brand-600 font-medium"
            >
              Search existing
            </button>
          )}
        </div>

        {addressMode === "search" ? (
          <div ref={dropdownRef} className="relative">
            <label className={labelClass}>Search address</label>
            <input
              type="text"
              value={addressQuery}
              onChange={(e) => {
                setAddressQuery(e.target.value);
                setSelectedAddress(null);
              }}
              onFocus={() => addressResults.length > 0 && setShowDropdown(true)}
              className={inputClass}
              placeholder="Start typing a street name or postal code…"
              disabled={isPending}
              autoComplete="off"
            />
            {showDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                {addressResults.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAddressSelect(addr);
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                  >
                    {formatAddress(addr)}
                  </button>
                ))}
              </div>
            )}
            {selectedAddress && (
              <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {formatAddress(selectedAddress)}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <AddressAutocomplete
              onSelect={(parsed) => {
                setStreetNumber(parsed.streetNumber);
                setStreetName(parsed.streetName);
                setCity(parsed.city);
                setProvince(parsed.province);
                setPostalCode(parsed.postalCode);
              }}
              placeholder="Search for an address…"
              inputClassName={inputClass}
              disabled={isPending}
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Street #</label>
                <input
                  type="text"
                  value={streetNumber}
                  onChange={(e) => setStreetNumber(e.target.value)}
                  className={inputClass}
                  placeholder="123"
                  disabled={isPending}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Street name</label>
                <input
                  type="text"
                  value={streetName}
                  onChange={(e) => setStreetName(e.target.value)}
                  className={inputClass}
                  placeholder="Main Street"
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Unit / apt</label>
                <input
                  type="text"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                  disabled={isPending}
                />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Oakville"
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Province</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className={inputClass}
                  disabled={isPending}
                />
              </div>
              <div>
                <label className={labelClass}>Postal code</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className={inputClass}
                  placeholder="L6J 1A1"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>
        )}

        {/* Unit override — only shown when an existing address is selected from search */}
        {addressMode === "search" && selectedAddress && (
          <div>
            <label className={labelClass}>
              Unit / apt{" "}
              <span className="text-slate-400 font-normal">(leave blank to use selected address as-is)</span>
            </label>
            <input
              type="text"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              className={inputClass}
              placeholder="e.g. 4B"
              disabled={isPending}
            />
          </div>
        )}
      </div>

      {/* ── Contact ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-5 space-y-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</h2>
        <div>
          <label className={labelClass}>Home phone</label>
          <input
            type="tel"
            value={phoneHome}
            onChange={(e) => setPhoneHome(e.target.value)}
            className={inputClass}
            placeholder="(905) 555-0100"
            disabled={isPending}
          />
        </div>
        <div>
          <label className={labelClass}>Mobile phone</label>
          <input
            type="tel"
            value={phoneMobile}
            onChange={(e) => setPhoneMobile(e.target.value)}
            className={inputClass}
            placeholder="(905) 555-0200"
            disabled={isPending}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="jane@example.com"
            disabled={isPending}
          />
        </div>
        <div>
          <label className={labelClass}>Birth date</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className={inputClass}
            disabled={isPending}
          />
        </div>
      </div>

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-5 space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${inputClass} resize-none`}
          rows={3}
          placeholder="Any initial notes about this resident…"
          disabled={isPending}
        />
      </div>

      {/* ── Tags ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-5 space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tags</h2>
        {selectedTagIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedTagIds.map((id) => {
              const tag = tags.find((t) => t.id === id);
              if (!tag) return null;
              const style = tag.color
                ? { backgroundColor: tag.color + "18", color: tag.color, borderColor: tag.color + "40" }
                : { backgroundColor: "#f1f5f9", color: "#475569", borderColor: "#e2e8f0" };
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full text-xs font-medium border px-2 py-0.5"
                  style={style}
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => setSelectedTagIds((prev) => prev.filter((x) => x !== id))}
                    disabled={isPending}
                    className="rounded-full hover:bg-black/10 p-0.5 transition-colors flex-shrink-0"
                    aria-label={`Remove ${tag.name}`}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <TagPicker
          campaignTags={tags}
          appliedTagIds={new Set(selectedTagIds)}
          onSelect={(tag) => setSelectedTagIds((prev) => [...prev, tag.id])}
          disabled={isPending}
        />
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <a
          href="/people/residents"
          className="inline-flex items-center h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="h-11 px-6 rounded-2xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : "Add resident"}
        </button>
      </div>
    </form>
  );
}
