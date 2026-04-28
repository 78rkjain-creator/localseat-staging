"use client";

import { useTransition, useState } from "react";
import { createPinDropContact } from "./actions";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";

export interface PinAddress {
  streetNumber: string;
  streetName: string;
  unitNumber: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface PinDropSuccess {
  personId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  lat: number;
  lng: number;
  initialAddress: PinAddress | null;
  geocoding: boolean;
  onSuccess: (result: PinDropSuccess) => void;
  onCancel: () => void;
}

export function PinDropPanel({ lat, lng, initialAddress, geocoding, onSuccess, onCancel }: Props) {
  const [isPending, startTransition] = useTransition();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [streetNumber, setStreetNumber] = useState(initialAddress?.streetNumber ?? "");
  const [streetName, setStreetName] = useState(initialAddress?.streetName ?? "");
  const [unitNumber, setUnitNumber] = useState(initialAddress?.unitNumber ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [province, setProvince] = useState(initialAddress?.province ?? "ON");
  const [postalCode, setPostalCode] = useState(initialAddress?.postalCode ?? "");
  const [phoneHome, setPhoneHome] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sync address fields if initialAddress arrives after mount (geocoding completes)
  const [lastSyncedAddr, setLastSyncedAddr] = useState<PinAddress | null>(null);
  if (initialAddress && initialAddress !== lastSyncedAddr) {
    setLastSyncedAddr(initialAddress);
    // Only pre-fill if the user hasn't typed anything yet
    if (!streetNumber && !streetName && !city) {
      setStreetNumber(initialAddress.streetNumber);
      setStreetName(initialAddress.streetName);
      setUnitNumber(initialAddress.unitNumber);
      setCity(initialAddress.city);
      setProvince(initialAddress.province);
      setPostalCode(initialAddress.postalCode);
    }
  }

  const inputClass =
    "w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createPinDropContact({
        firstName, lastName, phoneHome: phoneHome || undefined,
        streetNumber, streetName, unitNumber: unitNumber || undefined,
        city, province, postalCode,
        lat, lng,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      const addressLine = `${streetNumber} ${streetName}${unitNumber ? ` #${unitNumber}` : ""}`;
      onSuccess({
        personId: result.personId!,
        name: `${firstName.trim()} ${lastName.trim()}`,
        address: addressLine,
        lat,
        lng,
      });
    });
  }

  return (
    // Mobile: full-width bottom sheet above the mobile nav (bottom-16 = 64px nav height)
    // Desktop: fixed card in bottom-right corner of viewport
    <div className="fixed bottom-16 inset-x-0 z-50 md:bottom-4 md:right-4 md:left-auto md:inset-x-auto md:w-80">
      <div className="bg-white rounded-t-2xl md:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">

        {/* Handle bar — mobile only */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 md:pt-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-tight">New contact</p>
              <p className="text-[11px] text-slate-400 leading-tight">
                {geocoding ? "Looking up address…" : "Pin dropped"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 pb-4 flex flex-col gap-2">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-2">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              required
              autoComplete="given-name"
              className={inputClass}
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              required
              autoComplete="family-name"
              className={inputClass}
            />
          </div>

          {/* Address autocomplete */}
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
          />

          {/* Street address row */}
          <div className="flex gap-2">
            <input
              value={streetNumber}
              onChange={(e) => setStreetNumber(e.target.value)}
              placeholder="No."
              required
              className={`${inputClass} w-16 flex-shrink-0`}
            />
            <input
              value={streetName}
              onChange={(e) => setStreetName(e.target.value)}
              placeholder="Street name"
              required
              className={`${inputClass} flex-1 min-w-0`}
            />
            <input
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="Unit"
              className={`${inputClass} w-14 flex-shrink-0`}
            />
          </div>

          {/* City / postal */}
          <div className="grid grid-cols-2 gap-2">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              required
              className={inputClass}
            />
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="Postal code"
              className={inputClass}
            />
          </div>

          {/* Phone — optional */}
          <input
            value={phoneHome}
            onChange={(e) => setPhoneHome(e.target.value)}
            placeholder="Phone (optional)"
            type="tel"
            autoComplete="tel"
            className={inputClass}
          />

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 px-1">{error}</p>
          )}

          {/* Hint */}
          <p className="text-[11px] text-slate-400 px-0.5 -mt-0.5">
            Tap the map to move the pin.
          </p>

          {/* Actions */}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-11 rounded-2xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 h-11 rounded-2xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
