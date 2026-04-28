"use client";

import { useRef, useState, useTransition } from "react";
import { SignaturePad } from "./signature-pad";
import type { SignaturePadHandle } from "./signature-pad";

export type SignaturePurpose =
  | "lawn_sign_consent"
  | "volunteer_consent"
  | "petition"
  | "other";

const PURPOSE_LABELS: Record<SignaturePurpose, string> = {
  lawn_sign_consent: "Lawn sign consent",
  volunteer_consent: "Volunteer consent",
  petition: "Petition",
  other: "Other",
};

interface Props {
  personId: string;
  onClose: () => void;
  onSave: (data: { personId: string; purpose: string; signatureData: string }) => Promise<void>;
}

export function SignatureModal({ personId, onClose, onSave }: Props) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [purpose, setPurpose] = useState<SignaturePurpose>("lawn_sign_consent");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClear() {
    padRef.current?.clear();
    setError(null);
  }

  function handleSave() {
    if (padRef.current?.isEmpty()) {
      setError("Please draw a signature before saving.");
      return;
    }
    const dataURL = padRef.current?.getDataURL();
    if (!dataURL) return;
    setError(null);
    startTransition(async () => {
      await onSave({ personId, purpose, signatureData: dataURL });
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

          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Purpose</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as SignaturePurpose)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
            >
              {(Object.entries(PURPOSE_LABELS) as [SignaturePurpose, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

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
