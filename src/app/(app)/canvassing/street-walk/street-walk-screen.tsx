"use client";

// TODO: This feature currently requires an internet connection.
// Future work: add offline queuing using the same IndexedDB queue pattern
// as the regular canvass screen (lib/offline-queue.ts) so door entries
// are preserved and synced when connectivity is restored.

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { checkAddress, saveStreetWalkEntry } from "./actions";
import type { CheckAddressResult } from "./actions";
import type { SupportLevel } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

type Phase = "setup" | "walk";

interface StreetContext {
  name: string;
  city: string;
  province: string;
  postalPrefix: string;
}

interface PersonDraft {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  supportLevel: SupportLevel | null;
  signRequest: boolean;
  volunteerInterest: boolean;
  donorInterest: boolean;
  notes: string;
}

function emptyDraft(): PersonDraft {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    supportLevel: null,
    signRequest: false,
    volunteerInterest: false,
    donorInterest: false,
    notes: "",
  };
}

// ── Support level config — mirrors canvass-screen.tsx ──────────────────────

const SCALE_BUTTONS: {
  value: SupportLevel;
  numeral: number;
  caption: string;
  style: string;
  activeStyle: string;
}[] = [
  {
    value: "strong_yes",
    numeral: 5,
    caption: "Yes+",
    style: "border-emerald-200 bg-emerald-50 text-emerald-700",
    activeStyle: "border-emerald-600 bg-emerald-500 text-white",
  },
  {
    value: "soft_yes",
    numeral: 4,
    caption: "Yes",
    style: "border-teal-200 bg-white text-teal-700",
    activeStyle: "border-teal-600 bg-teal-500 text-white",
  },
  {
    value: "undecided",
    numeral: 3,
    caption: "?",
    style: "border-amber-200 bg-amber-50 text-amber-700",
    activeStyle: "border-amber-600 bg-amber-500 text-white",
  },
  {
    value: "soft_no",
    numeral: 2,
    caption: "No",
    style: "border-orange-200 bg-orange-50 text-orange-700",
    activeStyle: "border-orange-600 bg-orange-500 text-white",
  },
  {
    value: "strong_no",
    numeral: 1,
    caption: "No−",
    style: "border-red-200 bg-red-50 text-red-700",
    activeStyle: "border-red-600 bg-red-500 text-white",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────

function SupportButtons({
  selected,
  onSelect,
}: {
  selected: SupportLevel | null;
  onSelect: (l: SupportLevel | null) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {SCALE_BUTTONS.map((btn) => {
        const isActive = selected === btn.value;
        return (
          <button
            key={btn.value}
            type="button"
            onClick={() => onSelect(isActive ? null : btn.value)}
            className={[
              "flex-1 flex flex-col items-center py-3 rounded-xl border-2 font-semibold transition-colors touch-manipulation",
              isActive ? btn.activeStyle : btn.style,
            ].join(" ")}
          >
            <span className="text-xl leading-none">{btn.numeral}</span>
            <span className="text-[10px] mt-1 leading-none">{btn.caption}</span>
          </button>
        );
      })}
    </div>
  );
}

function ToggleButton({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "flex-1 h-11 rounded-xl text-sm font-medium border-2 transition-colors touch-manipulation",
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function PersonFormFields({
  draft,
  isNew,
  label,
  showRemove,
  onChange,
  onRemove,
}: {
  draft: PersonDraft;
  isNew: boolean;
  label?: string;
  showRemove: boolean;
  onChange: (d: PersonDraft) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-3">
      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        {label ? (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        ) : (
          <p className="font-medium text-slate-900">
            {draft.firstName || draft.lastName
              ? `${draft.firstName} ${draft.lastName}`.trim()
              : <span className="text-slate-400">New resident</span>}
          </p>
        )}
        {showRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="Remove person"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Name row — only for new people */}
      {isNew && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input
            type="text"
            value={draft.firstName}
            onChange={(e) => onChange({ ...draft, firstName: e.target.value })}
            placeholder="First name *"
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text"
            value={draft.lastName}
            onChange={(e) => onChange({ ...draft, lastName: e.target.value })}
            placeholder="Last name *"
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {/* Contact row */}
      {isNew && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input
            type="tel"
            value={draft.phone}
            onChange={(e) => onChange({ ...draft, phone: e.target.value })}
            placeholder="Phone (optional)"
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="email"
            value={draft.email}
            onChange={(e) => onChange({ ...draft, email: e.target.value })}
            placeholder="Email (optional)"
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {/* Support level */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Support level</p>
        <SupportButtons
          selected={draft.supportLevel}
          onSelect={(l) => onChange({ ...draft, supportLevel: l })}
        />
      </div>

      {/* Toggles */}
      <div className="flex gap-2 mb-3">
        <ToggleButton
          label="Sign"
          active={draft.signRequest}
          onToggle={() => onChange({ ...draft, signRequest: !draft.signRequest })}
        />
        <ToggleButton
          label="Volunteer"
          active={draft.volunteerInterest}
          onToggle={() => onChange({ ...draft, volunteerInterest: !draft.volunteerInterest })}
        />
        <ToggleButton
          label="Donor"
          active={draft.donorInterest}
          onToggle={() => onChange({ ...draft, donorInterest: !draft.donorInterest })}
        />
      </div>

      {/* Notes */}
      <textarea
        value={draft.notes}
        onChange={(e) => onChange({ ...draft, notes: e.target.value })}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400"
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  defaultCity: string;
  defaultProvince: string;
}

export function StreetWalkScreen({ defaultCity, defaultProvince }: Props) {
  const [phase, setPhase]               = useState<Phase>("setup");
  const [street, setStreet]             = useState<StreetContext | null>(null);
  const [setupStreet, setSetupStreet]   = useState("");
  const [setupCity, setSetupCity]       = useState(defaultCity);
  const [setupProvince, setSetupProvince] = useState(defaultProvince);
  const [setupPostal, setSetupPostal]   = useState("");

  const [houseNumber, setHouseNumber]   = useState("");
  const [unit, setUnit]                 = useState("");
  const [isChecking, setIsChecking]     = useState(false);
  const [checkResult, setCheckResult]   = useState<CheckAddressResult | null>(null);
  const [people, setPeople]             = useState<PersonDraft[]>([]);
  const [doorsToday, setDoorsToday]     = useState(0);
  const [toast, setToast]               = useState<{ message: string; key: number } | null>(null);
  const [checkError, setCheckError]     = useState<string | null>(null);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [isOnline, setIsOnline]         = useState(true);
  const [isPending, startTransition]    = useTransition();

  const houseInputRef = useRef<HTMLInputElement>(null);
  const setupStreetRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Auto-focus setup street input on mount
  useEffect(() => {
    setupStreetRef.current?.focus();
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSetupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!setupStreet.trim() || !setupCity.trim()) return;
    setStreet({
      name:         setupStreet.trim(),
      city:         setupCity.trim(),
      province:     setupProvince.trim() || "ON",
      postalPrefix: setupPostal.trim(),
    });
    setPhase("walk");
    // Focus house number after transition
    setTimeout(() => houseInputRef.current?.focus(), 50);
  }

  function handleChangeStreet() {
    setPhase("setup");
    setHouseNumber("");
    setUnit("");
    setCheckResult(null);
    setPeople([]);
    setCheckError(null);
    setSaveError(null);
    setTimeout(() => setupStreetRef.current?.focus(), 50);
  }

  const handleCheck = useCallback(async () => {
    if (!houseNumber.trim() || !street) return;
    setIsChecking(true);
    setCheckResult(null);
    setCheckError(null);
    setSaveError(null);
    setPeople([]);

    const result = await checkAddress(houseNumber.trim(), street.name, street.city);
    setIsChecking(false);

    if (result.error) {
      setCheckError(result.error);
      return;
    }

    setCheckResult(result);

    if (result.exists && result.residents && result.residents.length > 0) {
      // Pre-fill drafts from existing residents
      setPeople(
        result.residents.map((r) => ({
          id: r.id,
          firstName: r.firstName,
          lastName: r.lastName,
          phone: "",
          email: "",
          supportLevel: (r.currentSupportLevel as SupportLevel | undefined) ?? null,
          signRequest: false,
          volunteerInterest: false,
          donorInterest: false,
          notes: "",
        }))
      );
    } else {
      // New address or address with no residents — start with one blank form
      setPeople([emptyDraft()]);
    }
  }, [houseNumber, street]);

  function handleHouseKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCheck();
    }
  }

  function updatePerson(index: number, updates: Partial<PersonDraft>) {
    setPeople((prev) => prev.map((p, i) => (i === index ? { ...p, ...updates } : p)));
  }

  function removePerson(index: number) {
    setPeople((prev) => prev.filter((_, i) => i !== index));
  }

  function addAnotherPerson() {
    setPeople((prev) => [...prev, emptyDraft()]);
  }

  function handleSave() {
    if (!street || !checkResult) return;

    // Basic validation
    const validPeople = people.filter((p) =>
      p.id ? true : p.firstName.trim() && p.lastName.trim()
    );
    if (validPeople.length === 0) {
      setSaveError("Please enter at least one person's first and last name.");
      return;
    }

    setSaveError(null);

    startTransition(async () => {
      const result = await saveStreetWalkEntry({
        streetNumber: houseNumber.trim(),
        unit: unit.trim() || undefined,
        streetName: street.name,
        city: street.city,
        province: street.province,
        postalCode: street.postalPrefix || undefined,
        existingAddressId: checkResult.addressId,
        existingHouseholdId: checkResult.householdId,
        people: people
          .filter((p) => p.id ? true : p.firstName.trim() && p.lastName.trim())
          .map((p) => ({
            id: p.id,
            firstName: p.firstName || undefined,
            lastName: p.lastName || undefined,
            phone: p.phone || undefined,
            email: p.email || undefined,
            supportLevel: p.supportLevel ?? undefined,
            signRequest: p.signRequest,
            volunteerInterest: p.volunteerInterest,
            donorInterest: p.donorInterest,
            notes: p.notes || undefined,
          })),
      });

      if (result.error) {
        setSaveError(result.error);
        return;
      }

      setDoorsToday((prev) => prev + 1);
      setToast({
        message: `Saved — ${houseNumber.trim()} ${street.name}`,
        key: Date.now(),
      });

      // Reset for next door
      setHouseNumber("");
      setUnit("");
      setCheckResult(null);
      setPeople([]);
      houseInputRef.current?.focus();
    });
  }

  // ── Render: Phase 1 — Setup ────────────────────────────────────────────────

  if (phase === "setup") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Street Walk</h1>
            <p className="text-slate-500 text-sm mt-1">
              Which street are you canvassing?
            </p>
          </div>

          <form onSubmit={handleSetupSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                Street name *
              </label>
              <input
                ref={setupStreetRef}
                type="text"
                value={setupStreet}
                onChange={(e) => setSetupStreet(e.target.value)}
                placeholder="e.g. Oak Street"
                required
                className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                City *
              </label>
              <input
                type="text"
                value={setupCity}
                onChange={(e) => setSetupCity(e.target.value)}
                placeholder="e.g. Owen Sound"
                required
                className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Province
                </label>
                <input
                  type="text"
                  value={setupProvince}
                  onChange={(e) => setSetupProvince(e.target.value)}
                  placeholder="ON"
                  maxLength={2}
                  className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white uppercase"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Postal prefix
                </label>
                <input
                  type="text"
                  value={setupPostal}
                  onChange={(e) => setSetupPostal(e.target.value.toUpperCase())}
                  placeholder="N4K (optional)"
                  maxLength={6}
                  className="w-full h-12 rounded-2xl border border-slate-200 px-4 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!setupStreet.trim() || !setupCity.trim()}
              className="w-full h-14 rounded-2xl bg-brand-500 text-white font-semibold text-base hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              Start walking →
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Render: Phase 2 — Walk ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Street context banner */}
      <div className="sticky top-0 z-20 bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">
            {street!.name}, {street!.city}, {street!.province}
          </p>
          {doorsToday > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              Doors today: <span className="font-bold text-slate-200">{doorsToday}</span>
            </p>
          )}
        </div>
        <button
          onClick={handleChangeStreet}
          className="ml-3 text-xs text-slate-400 hover:text-slate-200 underline flex-shrink-0 transition-colors"
        >
          Change street
        </button>
      </div>

      {/* Offline warning */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-700 flex items-center gap-2">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Street walk requires an internet connection. Saved data will be lost if you close the app while offline.
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          key={toast.key}
          className="fixed top-20 left-0 right-0 flex justify-center pointer-events-none z-50 px-4"
        >
          <div className="bg-emerald-500 text-white px-5 py-2.5 rounded-2xl shadow-lg text-sm font-semibold">
            ✓ {toast.message}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full pb-32">

        {/* House number + unit + check */}
        <div className="mb-4">
          <div className="flex gap-2 items-end">
            {/* House number — large and prominent */}
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                House number
              </label>
              <input
                ref={houseInputRef}
                type="text"
                inputMode="numeric"
                value={houseNumber}
                onChange={(e) => {
                  setHouseNumber(e.target.value);
                  // Clear previous result when number changes
                  if (checkResult) {
                    setCheckResult(null);
                    setPeople([]);
                    setCheckError(null);
                  }
                }}
                onKeyDown={handleHouseKeyDown}
                placeholder="—"
                className="w-full h-16 text-3xl font-bold text-center rounded-2xl border-2 border-slate-200 focus:border-brand-500 focus:outline-none bg-white transition-colors"
              />
            </div>

            {/* Unit — smaller */}
            <div className="w-20">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">
                Unit
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="—"
                className="w-full h-16 text-lg font-semibold text-center rounded-2xl border-2 border-slate-200 focus:border-brand-500 focus:outline-none bg-white transition-colors"
              />
            </div>

            {/* Check button */}
            <button
              type="button"
              onClick={handleCheck}
              disabled={!houseNumber.trim() || isChecking}
              className="h-16 px-4 rounded-2xl bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation flex-shrink-0"
            >
              {isChecking ? (
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                "Check"
              )}
            </button>
          </div>

          {checkError && (
            <p className="mt-2 text-sm text-red-500">{checkError}</p>
          )}
        </div>

        {/* Check result */}
        {checkResult && (
          <div>
            {/* Address status badge */}
            {checkResult.exists ? (
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-medium">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Found {people.filter(p => p.id).length} {people.filter(p => p.id).length === 1 ? "person" : "people"} at {houseNumber} {street!.name}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                  <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  New address — enter resident info below
                </span>
              </div>
            )}

            {/* Person cards */}
            {people.map((draft, index) => (
              <PersonFormFields
                key={draft.id ?? `new-${index}`}
                draft={draft}
                isNew={!draft.id}
                label={draft.id ? `${draft.firstName} ${draft.lastName}` : undefined}
                showRemove={people.length > 1 && !draft.id}
                onChange={(updated) => updatePerson(index, updated)}
                onRemove={() => removePerson(index)}
              />
            ))}

            {/* Add another person */}
            <button
              type="button"
              onClick={addAnotherPerson}
              className="w-full h-11 rounded-2xl border-2 border-dashed border-slate-200 text-sm text-slate-500 font-medium hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/30 transition-colors mb-4"
            >
              + Add another person at this address
            </button>
          </div>
        )}
      </main>

      {/* Fixed footer — Save and next */}
      {checkResult && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 pt-3 pb-6 z-10">
          {saveError && (
            <p className="text-sm text-red-500 mb-2 text-center">{saveError}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="w-full h-14 rounded-2xl bg-brand-500 text-white font-semibold text-lg hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors touch-manipulation max-w-lg mx-auto flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : (
              "Save and next →"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
