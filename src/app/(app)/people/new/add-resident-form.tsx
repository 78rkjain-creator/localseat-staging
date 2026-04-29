"use client";

import { useState, useTransition } from "react";
import { addResident } from "./actions";
import { TagPicker } from "@/components/ui/tag-picker";
import { AddressPicker } from "@/components/ui/address-picker";
import type { AddressPickerResult } from "@/components/ui/address-picker";

interface Tag {
  id: string;
  name: string;
  color: string | null;
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

  // Address — resolved from picker
  const [pickedAddressId, setPickedAddressId] = useState<string | undefined>(undefined);
  const [streetNumber, setStreetNumber] = useState("");
  const [streetName, setStreetName] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("ON");
  const [postalCode, setPostalCode] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Contact
  const [phoneHome, setPhoneHome] = useState("");
  const [phoneMobile, setPhoneMobile] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");

  // Notes + tags
  const [notes, setNotes] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  function handleAddressPick(result: AddressPickerResult | null) {
    if (!result) {
      setPickedAddressId(undefined);
      setStreetNumber(""); setStreetName(""); setCity(""); setProvince("ON"); setPostalCode("");
      setLat(null); setLng(null);
      return;
    }
    if (result.type === "campaign") {
      setPickedAddressId(result.id);
      setStreetNumber(""); setStreetName(""); setCity(""); setProvince("ON"); setPostalCode("");
      setLat(null); setLng(null);
    } else if (result.type === "mapbox") {
      setPickedAddressId(undefined);
      setStreetNumber(result.streetNumber);
      setStreetName(result.streetName);
      setCity(result.city);
      setProvince(result.province);
      setPostalCode(result.postalCode);
      setLat(result.latitude);
      setLng(result.longitude);
    } else {
      setPickedAddressId(undefined);
      setStreetNumber(result.streetNumber);
      setStreetName(result.streetName);
      setCity(result.city);
      setProvince(result.province);
      setPostalCode(result.postalCode);
      setLat(null); setLng(null);
    }
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
        addressId: pickedAddressId,
        streetNumber: pickedAddressId ? undefined : streetNumber,
        streetName: pickedAddressId ? undefined : streetName,
        unitNumber: unitNumber || undefined,
        city: pickedAddressId ? undefined : city,
        province: pickedAddressId ? undefined : province,
        postalCode: pickedAddressId ? undefined : postalCode,
        lat: pickedAddressId ? undefined : lat,
        lng: pickedAddressId ? undefined : lng,
        phoneHome: phoneHome || undefined,
        phoneMobile: phoneMobile || undefined,
        email: email || undefined,
        birthDate: birthDate || undefined,
        notes: notes || undefined,
        tagIds: selectedTagIds,
      });
      if (result?.error) setError(result.error);
      // On success the server action redirects
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
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Address</h2>
        <div>
          <label className={labelClass}>Search address</label>
          <AddressPicker onSelect={handleAddressPick} />
        </div>
        <div>
          <label className={labelClass}>
            Unit / apt{" "}
            <span className="text-slate-400 font-normal">(optional)</span>
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
