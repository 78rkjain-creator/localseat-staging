"use client";

import { useState, useTransition } from "react";
import { submitAddressChangeRequest } from "@/lib/address-changes";

interface HouseholdMember {
  id: string;
  firstName: string;
  lastName: string;
}

interface CurrentAddress {
  id: string;
  streetNumber: string;
  streetName: string;
  unitNumber: string | null;
  city: string;
  province: string;
  postalCode: string;
}

interface AddressChangeModalProps {
  personId: string;
  campaignId: string;
  currentAddress: CurrentAddress | null;
  householdMembers: HouseholdMember[];
  onClose: () => void;
}

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

export function AddressChangeModal({
  personId,
  campaignId,
  currentAddress,
  householdMembers,
  onClose,
}: AddressChangeModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  function toggleMember(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const newAddressData = {
      streetNumber: (fd.get("streetNumber") as string).trim(),
      streetName: (fd.get("streetName") as string).trim(),
      unitNumber: (fd.get("unitNumber") as string).trim() || undefined,
      city: (fd.get("city") as string).trim(),
      province: (fd.get("province") as string).trim(),
      postalCode: (fd.get("postalCode") as string).trim(),
    };

    if (
      !newAddressData.streetNumber ||
      !newAddressData.streetName ||
      !newAddressData.city ||
      !newAddressData.postalCode
    ) {
      setError("Street number, street name, city, and postal code are required.");
      return;
    }

    const affectedPersonIds = [personId, ...Array.from(checkedIds)];

    startTransition(async () => {
      const result = await submitAddressChangeRequest({
        personId,
        campaignId,
        oldAddressId: currentAddress?.id ?? null,
        newAddressData,
        affectedPersonIds,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  // ── Success state ────────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Submitted for review</h2>
          <p className="text-sm text-slate-500 mb-6">
            Your address change request has been submitted. A team lead will review it shortly.
          </p>
          <button
            onClick={onClose}
            className="h-10 px-6 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">Request address change</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <form id="address-change-form" onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">
            {/* Current address */}
            {currentAddress && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Current address
                </p>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2.5">
                  {currentAddress.streetNumber} {currentAddress.streetName}
                  {currentAddress.unitNumber ? ` #${currentAddress.unitNumber}` : ""},{" "}
                  {currentAddress.city}, {currentAddress.province} {currentAddress.postalCode}
                </p>
              </div>
            )}

            {/* New address */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                New address
              </p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Street number" required>
                    <input
                      name="streetNumber"
                      required
                      placeholder="123"
                      className={inputCls}
                    />
                  </FormField>
                  <FormField label="Unit">
                    <input
                      name="unitNumber"
                      placeholder="Apt 4"
                      className={inputCls}
                    />
                  </FormField>
                </div>
                <FormField label="Street name" required>
                  <input
                    name="streetName"
                    required
                    placeholder="Main St"
                    className={inputCls}
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="City" required>
                    <input
                      name="city"
                      required
                      placeholder="Toronto"
                      className={inputCls}
                    />
                  </FormField>
                  <FormField label="Province">
                    <select name="province" defaultValue="ON" className={inputCls}>
                      {PROVINCES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <FormField label="Postal code" required>
                  <input
                    name="postalCode"
                    required
                    placeholder="M5V 1A1"
                    className={inputCls}
                  />
                </FormField>
              </div>
            </div>

            {/* Household members */}
            {householdMembers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Also moving?
                </p>
                <p className="text-xs text-slate-400 mb-3">
                  Select other household members who share this new address.
                </p>
                <div className="flex flex-col gap-2.5">
                  {householdMembers.map((m) => (
                    <label key={m.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checkedIds.has(m.id)}
                        onChange={() => toggleMember(m.id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 flex-shrink-0"
                      />
                      <span className="text-sm text-slate-700">
                        {m.firstName} {m.lastName}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                {error}
              </p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            form="address-change-form"
            type="submit"
            disabled={pending}
            className="h-9 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {pending ? "Submitting…" : "Submit for review"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full";
