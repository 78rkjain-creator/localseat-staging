"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeUserRole } from "@/app/(app)/team/role-actions";
import { ROLE_LABELS } from "@/types";
import type { Role } from "@/types";
import { Role as PrismaRole } from "@prisma/client";

// Roles that live on /people/volunteers (working tier)
const WORKING_TIER = new Set<string>(["canvasser", "sign_installer"]);

function isCrossTierMove(newRole: Role, context: "team" | "volunteers"): boolean {
  return context === "team" ? WORKING_TIER.has(newRole) : !WORKING_TIER.has(newRole);
}

interface Props {
  membershipId: string;
  personName: string;
  currentRole: Role;
  availableRoles: Role[];
  context: "team" | "volunteers";
}

export function RoleEditorCell({
  membershipId,
  personName,
  currentRole,
  availableRoles,
  context,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const destination = context === "team" ? "Volunteers" : "Team";

  function handleSelect(newRole: Role) {
    if (newRole === currentRole || isPending) return;
    setError(null);
    if (isCrossTierMove(newRole, context)) {
      setPendingRole(newRole);
    } else {
      commitChange(newRole, false);
    }
  }

  function commitChange(role: Role, crossTab: boolean) {
    startTransition(async () => {
      const result = await changeUserRole(membershipId, role as PrismaRole);
      if (result.error) {
        setError(result.error);
        setPendingRole(null);
        return;
      }
      setPendingRole(null);
      router.refresh();
      if (!crossTab) {
        setToast("Role updated");
        setTimeout(() => setToast(null), 2500);
      }
    });
  }

  return (
    <>
      {/* Cross-tier confirmation modal */}
      {pendingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Move to {destination}?
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Changing <strong>{personName}</strong>&apos;s role to{" "}
              <strong>{ROLE_LABELS[pendingRole]}</strong> will move them to the{" "}
              {destination} tab.
            </p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => commitChange(pendingRole, true)}
                disabled={isPending}
                className="flex-1 h-9 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Saving…" : "Continue"}
              </button>
              <button
                onClick={() => {
                  setPendingRole(null);
                  setError(null);
                }}
                disabled={isPending}
                className="flex-1 h-9 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline dropdown + status */}
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5">
          <select
            value={currentRole}
            onChange={(e) => handleSelect(e.target.value as Role)}
            disabled={isPending}
            className="h-8 rounded-xl border border-slate-200 bg-white px-2 pr-6 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 cursor-pointer"
            aria-label="Change role"
          >
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {isPending && (
            <svg
              className="h-3.5 w-3.5 text-slate-400 animate-spin flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          )}
        </div>
        {toast && (
          <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">
            {toast}
          </span>
        )}
        {error && !pendingRole && (
          <span className="text-[10px] text-red-600">{error}</span>
        )}
      </div>
    </>
  );
}
