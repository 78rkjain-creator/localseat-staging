"use client";

import { useState, useTransition } from "react";
import { submitNewResidentRequest } from "@/lib/voter-change-requests";

interface AddResidentModalProps {
  campaignId: string;
  campaignCity?: string;
  onClose: () => void;
}

export function AddResidentModal({
  campaignId,
  campaignCity = "",
  onClose,
}: AddResidentModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const firstName = (fd.get("firstName") as string).trim();
    const lastName = (fd.get("lastName") as string).trim();
    const streetNumber = (fd.get("streetNumber") as string).trim();
    const streetName = (fd.get("streetName") as string).trim();
    const city = (fd.get("city") as string).trim();
    const postalCode = (fd.get("postalCode") as string).trim();

    if (!firstName || !lastName || !streetNumber || !streetName || !city || !postalCode) {
      setError("First name, last name, street number, street name, city, and postal code are required.");
      return;
    }

    startTransition(async () => {
      const result = await submitNewResidentRequest({
        campaignId,
        residentData: {
          firstName,
          lastName,
          phone: (fd.get("phone") as string).trim() || undefined,
          email: (fd.get("email") as string).trim() || undefined,
          streetNumber,
          streetName,
          unitNumber: (fd.get("unitNumber") as string).trim() || undefined,
          city,
          postalCode,
        },
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
          <h2 className="text-lg font-semibold text-slate-900 mb-1">New resident submitted</h2>
          <p className="text-sm text-slate-500 mb-6">
            This resident has been submitted for review and will appear in the voter list once a manager approves.
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
          <h2 className="text-lg font-semibold text-slate-900">Add new resident</h2>
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
          <form id="add-resident-form" onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
            <p className="text-xs text-slate-400">
              This submission will be reviewed before the resident appears in the voter list.
            </p>

            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" required>
                <input name="firstName" required className={inputCls} />
              </FormField>
              <FormField label="Last name" required>
                <input name="lastName" required className={inputCls} />
              </FormField>
            </div>

            {/* Address */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Street number" required>
                <input name="streetNumber" required placeholder="123" className={inputCls} />
              </FormField>
              <FormField label="Unit">
                <input name="unitNumber" placeholder="Apt 4" className={inputCls} />
              </FormField>
            </div>
            <FormField label="Street name" required>
              <input name="streetName" required placeholder="Main St" className={inputCls} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="City" required>
                <input name="city" required defaultValue={campaignCity} className={inputCls} />
              </FormField>
              <FormField label="Postal code" required>
                <input name="postalCode" required placeholder="N4K 1A1" className={inputCls} />
              </FormField>
            </div>

            {/* Contact — optional */}
            <FormField label="Phone">
              <input name="phone" type="tel" placeholder="519-555-0100" className={inputCls} />
            </FormField>
            <FormField label="Email">
              <input name="email" type="email" placeholder="name@example.com" className={inputCls} />
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
            form="add-resident-form"
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
