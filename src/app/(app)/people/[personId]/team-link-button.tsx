"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkPersonToUser, unlinkPersonFromUser } from "./actions";
import { ROLE_LABELS } from "@/types";
import type { Role } from "@/types";

export interface AvailableMember {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Props {
  personId: string;
  linkedUserId: string | null;
  linkedRole: string | null;
  availableMembers: AvailableMember[];
}

export function TeamLinkButton({
  personId,
  linkedUserId,
  linkedRole,
  availableMembers,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  function handleLink(userId: string) {
    setError(null);
    setShowDropdown(false);
    startTransition(async () => {
      const result = await linkPersonToUser(personId, userId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleUnlink() {
    setError(null);
    startTransition(async () => {
      const result = await unlinkPersonFromUser(personId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  if (linkedUserId && linkedRole) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Team · {ROLE_LABELS[linkedRole as Role] ?? linkedRole}
        </span>
        <button
          onClick={handleUnlink}
          disabled={isPending}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
        >
          Unlink
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2 relative">
      {!showDropdown ? (
        <button
          onClick={() => setShowDropdown(true)}
          disabled={isPending || availableMembers.length === 0}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          {availableMembers.length === 0 ? "No unlinked team members" : "Link to team member"}
        </button>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden w-72">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-600">Link to team member</p>
            <button
              onClick={() => setShowDropdown(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {availableMembers.map((m) => (
              <li key={m.userId}>
                <button
                  onClick={() => handleLink(m.userId)}
                  disabled={isPending}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <p className="text-sm font-medium text-slate-800">
                    {m.firstName} {m.lastName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {ROLE_LABELS[m.role as Role] ?? m.role} · {m.email}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
