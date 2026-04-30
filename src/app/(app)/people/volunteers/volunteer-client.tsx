"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPureVolunteer, removeVolunteerRecord, removeVolunteerMembership } from "./actions";

// ── AddVolunteerPanel ─────────────────────────────────────────────────────────

function AddVolunteerPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const input = {
      firstName: fd.get("firstName") as string,
      lastName: fd.get("lastName") as string,
      email: (fd.get("email") as string) || null,
      phoneHome: (fd.get("phoneHome") as string) || null,
      phoneMobile: (fd.get("phoneMobile") as string) || null,
    };
    startTransition(async () => {
      const result = await addPureVolunteer(input);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Add volunteer</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              First name <span className="text-red-400">*</span>
            </label>
            <input
              name="firstName"
              required
              className="w-full h-9 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Last name <span className="text-red-400">*</span>
            </label>
            <input
              name="lastName"
              required
              className="w-full h-9 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input
            name="email"
            type="email"
            className="w-full h-9 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mobile</label>
            <input
              name="phoneMobile"
              type="tel"
              className="w-full h-9 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Home phone</label>
            <input
              name="phoneHome"
              type="tel"
              className="w-full h-9 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 h-9 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Adding…" : "Add volunteer"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── AddVolunteerButton ────────────────────────────────────────────────────────

export function AddVolunteerButton() {
  const [open, setOpen] = useState(false);
  if (open) return <AddVolunteerPanel onClose={() => setOpen(false)} />;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="h-9 px-4 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
    >
      + Add volunteer
    </button>
  );
}

// ── RemoveVolunteerButton ─────────────────────────────────────────────────────

export type VolunteerTier = "canvasser" | "sign_installer" | "volunteer";

interface RemoveVolunteerButtonProps {
  tier: VolunteerTier;
  personId: string;
  userId?: string | null;
  name: string;
}

export function RemoveVolunteerButton({ tier, personId, userId, name }: RemoveVolunteerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isMember = tier === "canvasser" || tier === "sign_installer";
  const tierLabel = tier === "canvasser" ? "canvasser" : tier === "sign_installer" ? "sign installer" : "volunteer";

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result =
        isMember && userId
          ? await removeVolunteerMembership(userId)
          : await removeVolunteerRecord(personId);

      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="text-xs text-slate-400 hover:text-red-500 transition-colors"
      >
        Remove
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Remove {tierLabel}?
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {isMember
                ? `This will end ${name}'s ${tierLabel} membership and revoke their access to the campaign app. Their contact record will remain.`
                : `This will clear ${name}'s volunteer flag. They will remain in the system as a contact.`}
            </p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRemove}
                disabled={isPending}
                className="flex-1 h-9 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Removing…" : "Remove"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                className="flex-1 h-9 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
