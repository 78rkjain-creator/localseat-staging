"use client";

import { useState, useTransition } from "react";
import { promoteVolunteerToUser } from "./promote-actions";

const PROMOTABLE_ROLES = [
  { value: "canvasser", label: "Canvasser" },
  { value: "volunteer_coordinator", label: "Volunteer Coordinator" },
  { value: "field_organizer", label: "Field Organizer" },
  { value: "campaign_manager", label: "Campaign Manager" },
  { value: "finance_lead", label: "Finance Lead" },
  { value: "sign_installer", label: "Sign Installer" },
];

interface Props {
  personId: string;
  personName: string;
  personEmail: string;
}

export function PromoteToUserButton({ personId, personName, personEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState("canvasser");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    setError(null);
    setSelectedRole("canvasser");
  }

  function handleCancel() {
    setOpen(false);
    setError(null);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await promoteVolunteerToUser(personId, selectedRole);
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        setOpen(false);
      }
    });
  }

  if (done) {
    return (
      <span className="mt-2 inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        User account created — invite email sent
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Create user account
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Create user account</h2>
            <p className="text-sm text-slate-500 mb-5">
              This will send <span className="font-medium text-slate-700">{personName}</span> ({personEmail}) an
              invite email so they can set a password and access the campaign.
            </p>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Campaign role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {PROMOTABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 mb-4">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="h-10 px-4 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50"
              >
                {isPending ? "Creating…" : "Create account & send invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
