"use client";

import { useState, useTransition } from "react";
import { submitVoterChangeRequest, type VoterChangeFields } from "@/lib/voter-change-requests";

interface CurrentRecord {
  id: string;
  firstName: string;
  lastName: string;
  phoneHome: string | null;
  phoneMobile: string | null;
  email: string | null;
  birthDate: string | null;
}

interface VoterChangeModalProps {
  personId: string;
  campaignId: string;
  currentRecord: CurrentRecord;
  onClose: () => void;
}

export function VoterChangeModal({
  personId,
  campaignId,
  currentRecord,
  onClose,
}: VoterChangeModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const proposed: VoterChangeFields = {
      firstName: (fd.get("firstName") as string).trim(),
      lastName: (fd.get("lastName") as string).trim(),
      phoneHome: (fd.get("phoneHome") as string).trim() || null,
      phoneMobile: (fd.get("phoneMobile") as string).trim() || null,
      email: (fd.get("email") as string).trim() || null,
      birthDate: (fd.get("birthDate") as string).trim() || null,
    };

    // Only include fields that differ from the current record
    const changes: VoterChangeFields = {};
    if (proposed.firstName !== currentRecord.firstName) changes.firstName = proposed.firstName;
    if (proposed.lastName !== currentRecord.lastName) changes.lastName = proposed.lastName;
    if ((proposed.phoneHome ?? null) !== (currentRecord.phoneHome ?? null)) changes.phoneHome = proposed.phoneHome;
    if ((proposed.phoneMobile ?? null) !== (currentRecord.phoneMobile ?? null)) changes.phoneMobile = proposed.phoneMobile;
    if ((proposed.email ?? null) !== (currentRecord.email ?? null)) changes.email = proposed.email;
    if ((proposed.birthDate ?? null) !== (currentRecord.birthDate ?? null)) changes.birthDate = proposed.birthDate;

    if (Object.keys(changes).length === 0) {
      setError("No changes detected. Update at least one field before submitting.");
      return;
    }

    const snapshot: VoterChangeFields = {
      firstName: currentRecord.firstName,
      lastName: currentRecord.lastName,
      phoneHome: currentRecord.phoneHome,
      phoneMobile: currentRecord.phoneMobile,
      email: currentRecord.email,
      birthDate: currentRecord.birthDate,
    };

    startTransition(async () => {
      const result = await submitVoterChangeRequest({
        personId,
        campaignId,
        proposedChanges: changes,
        currentSnapshot: snapshot,
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
            Your correction has been submitted. A team lead will review it shortly.
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
          <h2 className="text-lg font-semibold text-slate-900">Correct voter record</h2>
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
          <form id="voter-change-form" onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
            <p className="text-xs text-slate-400">
              Edit any fields below. Only changed fields will be submitted for review.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" required>
                <input
                  name="firstName"
                  required
                  defaultValue={currentRecord.firstName}
                  className={inputCls}
                />
              </FormField>
              <FormField label="Last name" required>
                <input
                  name="lastName"
                  required
                  defaultValue={currentRecord.lastName}
                  className={inputCls}
                />
              </FormField>
            </div>

            <FormField label="Home phone">
              <input
                name="phoneHome"
                type="tel"
                defaultValue={currentRecord.phoneHome ?? ""}
                placeholder="519-555-0100"
                className={inputCls}
              />
            </FormField>

            <FormField label="Mobile phone">
              <input
                name="phoneMobile"
                type="tel"
                defaultValue={currentRecord.phoneMobile ?? ""}
                placeholder="519-555-0101"
                className={inputCls}
              />
            </FormField>

            <FormField label="Email">
              <input
                name="email"
                type="email"
                defaultValue={currentRecord.email ?? ""}
                placeholder="name@example.com"
                className={inputCls}
              />
            </FormField>

            <FormField label="Birth date">
              <input
                name="birthDate"
                type="date"
                min="1900-01-01"
                max={`${new Date().getFullYear()}-12-31`}
                defaultValue={currentRecord.birthDate ?? ""}
                className={inputCls}
              />
            </FormField>

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
            form="voter-change-form"
            type="submit"
            disabled={pending}
            className="h-9 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {pending ? "Submitting…" : "Submit correction"}
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
