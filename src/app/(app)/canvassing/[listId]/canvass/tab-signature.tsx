"use client";

import type { CanvassState } from "./use-canvass-state";
import { SignatureModal } from "@/components/signature-modal";
import { saveSignature } from "@/app/(app)/people/[personId]/signature-actions";

interface TabSignatureProps {
  state: CanvassState;
}

export function TabSignature({ state }: TabSignatureProps) {
  const {
    consentTypes,
    selectedPersonId,
    current,
    showSignatureModal,
    setShowSignatureModal,
  } = state;

  if (consentTypes.length === 0) return null;

  const personName = current
    ? `${current.person.firstName} ${current.person.lastName}`
    : "";

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-2.5 z-10">
        <p className="text-xs text-slate-500 truncate">
          <span className="font-semibold text-slate-700">Consent for:</span> {personName}
        </p>
      </div>

      {/* Consent types list */}
      <div className="px-4 py-4 max-w-lg mx-auto">
        <p className="text-sm font-semibold text-slate-700 mb-3">
          Available consent types
        </p>

        <div className="space-y-2 mb-6">
          {consentTypes.map((ct) => (
            <div
              key={ct.id}
              className="bg-white rounded-xl border border-slate-200 px-4 py-3"
            >
              <p className="text-sm font-medium text-slate-800">{ct.label}</p>
            </div>
          ))}
        </div>

        {/* Collect signature button */}
        <button
          type="button"
          onClick={() => setShowSignatureModal(true)}
          className="w-full h-14 rounded-2xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-bold text-base transition-colors flex items-center justify-center gap-2"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Collect Signature
        </button>

        <p className="text-xs text-slate-400 text-center mt-3">
          Opens the signature capture screen. Select consent types and have the person sign.
        </p>
      </div>

      {/* Signature modal (reuse existing component) */}
      {showSignatureModal && (
        <SignatureModal
          personId={selectedPersonId}
          consentTypes={consentTypes}
          onClose={() => setShowSignatureModal(false)}
          onSave={saveSignature}
        />
      )}
    </div>
  );
}
