"use client";

import { useActionState, useState } from "react";
import { saveGeneralSettings } from "./actions";
import type { GeneralSettingsState } from "./actions";
import { AddressPicker } from "@/components/ui/address-picker";
import type { AddressPickerResult } from "@/components/ui/address-picker";
import { MunicipalitySelector } from "@/components/ui/municipality-selector";
import type { MunicipalitySelectorValue } from "@/components/ui/municipality-selector";
import { MunicipalityMap } from "@/components/ui/municipality-map";
import type { Polygon, MultiPolygon } from "geojson";

interface VotingDate {
  date: string;
  time: string;
}

interface OfficeAddr {
  streetNumber: string;
  streetName: string;
  unitNumber: string;
  city: string;
  province: string;
  postalCode: string;
  lat: string;
  lng: string;
  addressId: string;
}

interface Props {
  name: string;
  electionDateValue: string;
  fundraisingGoal: number | null;
  advanceVotingDates: VotingDate[];
  initialOfficeAddr: OfficeAddr | null;
  initialOfficeDisplay: string;
  initialMunicipalityName: string | null;
  initialMunicipalityId: string | null;
  initialMunicipalityBoundary: Polygon | MultiPolygon | null;
}

interface BoundaryIndex {
  [id: string]: string;
}

function bboxToPolygon(bbox: [number, number, number, number]): Polygon {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return {
    type: "Polygon",
    coordinates: [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]],
  };
}

const initialState: GeneralSettingsState = {};

function formatOfficeDisplay(a: OfficeAddr): string {
  return `${a.streetNumber} ${a.streetName}${a.unitNumber ? ` #${a.unitNumber}` : ""}, ${a.city}, ${a.province} ${a.postalCode}`.trim();
}

export function GeneralSettingsForm({
  name,
  electionDateValue,
  fundraisingGoal,
  advanceVotingDates: initialAdvanceDates,
  initialOfficeAddr,
  initialOfficeDisplay,
  initialMunicipalityName,
  initialMunicipalityId,
  initialMunicipalityBoundary,
}: Props) {
  const [state, formAction, isPending] = useActionState(saveGeneralSettings, initialState);
  const [vDates, setVDates] = useState<VotingDate[]>(initialAdvanceDates);
  const [officeAddr, setOfficeAddr] = useState<OfficeAddr | null>(initialOfficeAddr);
  const [showPicker, setShowPicker] = useState(!initialOfficeAddr);
  const [municipality, setMunicipality] = useState<MunicipalitySelectorValue | null>(
    initialMunicipalityName ? { id: initialMunicipalityId, name: initialMunicipalityName } : null
  );
  const [municipalityBoundary, setMunicipalityBoundary] = useState<Polygon | MultiPolygon | null>(
    initialMunicipalityBoundary
  );
  const [loadingBoundary, setLoadingBoundary] = useState(false);

  async function fetchAndSetBoundary(id: string, bbox?: [number, number, number, number]) {
    setLoadingBoundary(true);
    try {
      const indexRes = await fetch("/data/boundaries/index.json").catch(() => null);
      if (indexRes?.ok) {
        const index: BoundaryIndex = await indexRes.json();
        const path = index[id];
        if (path) {
          const geoRes = await fetch(path);
          if (geoRes.ok) {
            setMunicipalityBoundary((await geoRes.json()) as Polygon | MultiPolygon);
            return;
          }
        }
      }
      if (bbox) setMunicipalityBoundary(bboxToPolygon(bbox));
    } catch {
      if (bbox) setMunicipalityBoundary(bboxToPolygon(bbox));
    } finally {
      setLoadingBoundary(false);
    }
  }

  async function handleMunicipalityChange(value: MunicipalitySelectorValue | null) {
    setMunicipality(value);
    setMunicipalityBoundary(null);
    if (value?.id) {
      await fetchAndSetBoundary(value.id, value.bbox);
    } else if (value?.bbox) {
      setMunicipalityBoundary(bboxToPolygon(value.bbox));
    }
  }

  function addDate() {
    setVDates((d) => [...d, { date: "", time: "09:00" }]);
  }

  function removeDate(idx: number) {
    setVDates((d) => d.filter((_, i) => i !== idx));
  }

  function updateDate(idx: number, field: "date" | "time", value: string) {
    setVDates((d) => d.map((entry, i) => i === idx ? { ...entry, [field]: value } : entry));
  }

  function handleOfficeSelect(result: AddressPickerResult | null) {
    if (!result) {
      setOfficeAddr(null);
      return;
    }
    if (result.type === "campaign") {
      setOfficeAddr({
        streetNumber: result.streetNumber,
        streetName: result.streetName,
        unitNumber: result.unitNumber ?? "",
        city: result.city,
        province: result.province,
        postalCode: result.postalCode,
        lat: "",
        lng: "",
        addressId: result.id,
      });
      setShowPicker(false);
    } else if (result.type === "mapbox") {
      setOfficeAddr({
        streetNumber: result.streetNumber,
        streetName: result.streetName,
        unitNumber: "",
        city: result.city,
        province: result.province,
        postalCode: result.postalCode,
        lat: String(result.latitude),
        lng: String(result.longitude),
        addressId: "",
      });
      setShowPicker(false);
    } else {
      setOfficeAddr({
        streetNumber: result.streetNumber,
        streetName: result.streetName,
        unitNumber: result.unitNumber ?? "",
        city: result.city,
        province: result.province,
        postalCode: result.postalCode,
        lat: "",
        lng: "",
        addressId: "",
      });
      setShowPicker(false);
    }
  }

  function clearOffice() {
    setOfficeAddr(null);
    setShowPicker(true);
  }

  return (
    <form action={formAction}>
      {/* Hidden count for advance voting dates */}
      <input type="hidden" name="advanceDateCount" value={vDates.length} />
      {vDates.map((entry, i) => (
        <span key={i}>
          <input type="hidden" name={`advanceDate_${i}`} value={entry.date} />
          <input type="hidden" name={`advanceTime_${i}`} value={entry.time} />
        </span>
      ))}

      {/* Hidden office address fields */}
      <input type="hidden" name="officeStreetNumber" value={officeAddr?.streetNumber ?? ""} />
      <input type="hidden" name="officeStreetName"   value={officeAddr?.streetName ?? ""} />
      <input type="hidden" name="officeUnitNumber"   value={officeAddr?.unitNumber ?? ""} />
      <input type="hidden" name="officeCity"         value={officeAddr?.city ?? ""} />
      <input type="hidden" name="officeProvince"     value={officeAddr?.province ?? ""} />
      <input type="hidden" name="officePostalCode"   value={officeAddr?.postalCode ?? ""} />
      <input type="hidden" name="officeAddressLat"   value={officeAddr?.lat ?? ""} />
      <input type="hidden" name="officeAddressLng"   value={officeAddr?.lng ?? ""} />
      <input type="hidden" name="officeAddressId"    value={officeAddr?.addressId ?? ""} />

      {/* Hidden municipality fields */}
      <input type="hidden" name="municipalityName"     value={municipality?.name ?? ""} />
      <input type="hidden" name="municipalityId"       value={municipality?.id ?? ""} />
      <input type="hidden" name="municipalityBoundary" value={municipalityBoundary ? JSON.stringify(municipalityBoundary) : ""} />

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">

        {/* Campaign name */}
        <div className="px-5 py-5">
          <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Campaign name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={name}
            placeholder="e.g. Alex Chen for Ward 3"
            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            Shown in the sidebar and on exports.
          </p>
        </div>

        {/* Election date */}
        <div className="px-5 py-5">
          <label htmlFor="electionDate" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Election date
          </label>
          <input
            id="electionDate"
            name="electionDate"
            type="date"
            defaultValue={electionDateValue}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            Used on the dashboard to show days remaining.
          </p>
        </div>

        {/* Fundraising goal */}
        <div className="px-5 py-5">
          <label htmlFor="fundraisingGoal" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Fundraising goal
          </label>
          <div className="relative inline-flex items-center">
            <span className="absolute left-3 text-sm text-slate-400 pointer-events-none">$</span>
            <input
              id="fundraisingGoal"
              name="fundraisingGoal"
              type="number"
              min="0"
              step="1"
              defaultValue={fundraisingGoal ?? ""}
              placeholder="0"
              className="h-10 pl-7 pr-3 w-40 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Shown on the finance dashboard as a progress target.
          </p>
        </div>

        {/* Office address */}
        <div className="px-5 py-5">
          <p className="text-sm font-semibold text-slate-700 mb-1.5">Office address</p>
          <p className="text-xs text-slate-400 mb-3">
            Shown as a pin on the contact map.
          </p>

          {officeAddr && !showPicker ? (
            <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
              <div className="h-6 w-6 rounded bg-violet-100 flex items-center justify-center flex-shrink-0">
                <svg className="h-3.5 w-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm text-slate-800 flex-1 leading-snug">{formatOfficeDisplay(officeAddr)}</p>
              <button
                type="button"
                onClick={clearOffice}
                className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors flex-shrink-0"
              >
                Clear
              </button>
            </div>
          ) : (
            <AddressPicker onSelect={handleOfficeSelect} />
          )}

          {initialOfficeDisplay && !officeAddr && (
            <p className="text-xs text-slate-400 mt-1.5">
              Previously: {initialOfficeDisplay}
            </p>
          )}
        </div>

        {/* Advance voting dates */}
        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Advance voting dates</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Dates when advance polls are open.
              </p>
            </div>
          </div>

          {vDates.length === 0 ? (
            <p className="text-sm text-slate-400 mb-3">No advance voting dates set.</p>
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              {vDates.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={entry.date}
                    onChange={(e) => updateDate(i, "date", e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    type="time"
                    value={entry.time}
                    onChange={(e) => updateDate(i, "time", e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeDate(i)}
                    className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors"
                    title="Remove this date"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addDate}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add another date
          </button>
        </div>

        {/* Municipality */}
        <div className="px-5 py-5">
          <p className="text-sm font-semibold text-slate-700 mb-1.5">Municipality</p>
          <p className="text-xs text-slate-400 mb-3">
            The Ontario municipality where this campaign is running.
          </p>
          <MunicipalitySelector
            value={municipality}
            onChange={handleMunicipalityChange}
            placeholder="Search Ontario municipalities…"
          />
          <div className="mt-3">
            <MunicipalityMap
              boundary={municipalityBoundary}
              municipalityName={municipality?.name ?? null}
              center={municipality?.center}
              loading={loadingBoundary}
            />
          </div>
        </div>

      </div>

      {state.error && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {state.error}
        </p>
      )}

      {state.success && (
        <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
          Settings saved.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="h-10 px-6 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
