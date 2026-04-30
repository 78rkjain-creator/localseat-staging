"use client";

import { useRef, useState, useTransition } from "react";
import { SignaturePad } from "./signature-pad";
import type { SignaturePadHandle } from "./signature-pad";

export interface ConsentTypeOption {
  id: string;
  label: string;
}

interface Props {
  personId: string;
  consentTypes: ConsentTypeOption[];
  onClose: () => void;
  onSave: (data: { personId: string; consentTypeIds: string[]; signatureData: string }) => Promise<void>;
}

export function SignatureModal({ personId, consentTypes, onClose, onSave }: Props) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    consentTypes.length > 0 ? [consentTypes[0]!.id] : []
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleType(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleClear() {
    padRef.current?.clear();
    setError(null);
  }

  function handleSave() {
    if (selectedIds.length === 0) {
      setError("Select at least one consent type.");
      return;
    }
    if (padRef.current?.isEmpty()) {
      setError("Please draw a signature before saving.");
      return;
    }
    const dataURL = padRef.current?.getDataURL();
    if (!dataURL) return;
    setError(null);
    startTransition(async () => {
      await onSave({ personId, consentTypeIds: selectedIds, signatureData: dataURL });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl z-10">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Collect signature</h2>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {consentTypes.length > 0 && (
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
                Purpose
              </label>
              <div className="flex flex-col gap-2">
                {consentTypes.map((type) => (
                  <label key={type.id} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(type.id)}
                      onChange={() => toggleType(type.id)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-sm text-slate-800">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <SignaturePad ref={padRef} height={200} />

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={handleClear}
              className="h-11 px-4 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 h-11 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-2xl transition-colors"
            >
              {isPending ? "Saving…" : "Save signature"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
