"use client";

import { useState } from "react";
import { SignatureModal } from "@/components/signature-modal";
import type { ConsentTypeOption } from "@/components/signature-modal";

const LEGACY_PURPOSE_LABELS: Record<string, string> = {
  lawn_sign_consent: "Lawn sign consent",
  volunteer_consent: "Volunteer consent",
  petition: "Petition",
  other: "Other",
};

interface ConsentItem {
  consentType: { label: string };
}

interface SignatureItem {
  id: string;
  purpose: string;
  signatureData: string;
  collectedAt: Date;
  collectedBy: { firstName: string; lastName: string };
  consentItems: ConsentItem[];
}

interface Props {
  personId: string;
  signatures: SignatureItem[];
  consentTypes: ConsentTypeOption[];
  onSave: (data: { personId: string; consentTypeIds: string[]; signatureData: string }) => Promise<void>;
}

function purposeLabel(sig: SignatureItem): string {
  if (sig.consentItems.length > 0) {
    return sig.consentItems.map((c) => c.consentType.label).join(", ");
  }
  return LEGACY_PURPOSE_LABELS[sig.purpose] ?? sig.purpose;
}

export function SignatureSection({ personId, signatures, consentTypes, onSave }: Props) {
  const [showModal, setShowModal] = useState(false);

  function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div>
      {signatures.length > 0 ? (
        <div className="flex flex-col gap-3 mb-4">
          {signatures.map((sig) => (
            <div key={sig.id} className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sig.signatureData}
                alt="Signature"
                className="h-14 w-32 object-contain border border-slate-200 rounded-lg bg-white flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{purposeLabel(sig)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatDate(sig.collectedAt)} · {sig.collectedBy.firstName} {sig.collectedBy.lastName}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 mb-4">No signatures collected yet.</p>
      )}

      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        Collect signature
      </button>

      {showModal && (
        <SignatureModal
          personId={personId}
          consentTypes={consentTypes}
          onClose={() => setShowModal(false)}
          onSave={onSave}
        />
      )}
    </div>
  );
}
