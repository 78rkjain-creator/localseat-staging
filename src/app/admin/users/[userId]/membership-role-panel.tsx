"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Role } from "@/types";
import { ROLE_LABELS } from "@/types";
import {
  adminChangeUserRoleFromUserPanel,
  adminTransferCandidateRoleFromUserPanel,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserMembershipEntry {
  id: string;
  role: string;
  deletedAt: Date | null;
  createdAt: Date;
  campaign: {
    id: string;
    name: string;
    municipality: string | null;
    city: string | null;
  };
  currentCandidateMembershipId: string | null;
  currentCandidateName: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_ORDER: Role[] = [
  "candidate",
  "campaign_manager",
  "data_manager",
  "co_chair",
  "field_organizer",
  "volunteer_coordinator",
  "canvasser",
  "finance_lead",
];

const NON_CANDIDATE_ROLES: Role[] = ROLE_ORDER.filter((r) => r !== "candidate");

const selectCls =
  "h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500";

// ── Panel ─────────────────────────────────────────────────────────────────────

export function MembershipRolePanel({
  memberships,
}: {
  memberships: UserMembershipEntry[];
}) {
  const router = useRouter();

  // Transfer modal state lifted to panel level so it renders outside the table
  const [transferTarget, setTransferTarget] = useState<{
    membershipId: string;
    currentCandidateMembershipId: string;
    currentCandidateName: string;
  } | null>(null);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  async function handleTransferConfirm(
    formerCandidateNewRole: import("@prisma/client").Role
  ) {
    if (!transferTarget) return;
    setTransferSaving(true);
    setTransferError(null);
    const result = await adminTransferCandidateRoleFromUserPanel(
      transferTarget.currentCandidateMembershipId,
      transferTarget.membershipId,
      formerCandidateNewRole
    );
    setTransferSaving(false);
    if (result.error) {
      setTransferError(result.error);
      return;
    }
    setTransferTarget(null);
    router.refresh();
  }

  function handleTransferCancel() {
    setTransferTarget(null);
    setTransferError(null);
  }

  return (
    <>
      {/* Transfer modal — outside table to avoid invalid DOM nesting */}
      {transferTarget && (
        <UserTransferModal
          currentCandidateName={transferTarget.currentCandidateName}
          saving={transferSaving}
          error={transferError}
          onConfirm={handleTransferConfirm}
          onCancel={handleTransferCancel}
        />
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-50">
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Campaign
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Role
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">
              Joined
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {memberships.map((m) => (
            <MembershipRow
              key={m.id}
              membership={m}
              onRequestTransfer={(currentCandidateMembershipId, currentCandidateName) =>
                setTransferTarget({
                  membershipId: m.id,
                  currentCandidateMembershipId,
                  currentCandidateName,
                })
              }
              onChanged={() => router.refresh()}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function MembershipRow({
  membership,
  onRequestTransfer,
  onChanged,
}: {
  membership: UserMembershipEntry;
  onRequestTransfer: (
    currentCandidateMembershipId: string,
    currentCandidateName: string
  ) => void;
  onChanged: () => void;
}) {
  const role = membership.role as Role;
  const isDeleted = !!membership.deletedAt;
  const isCandidate = role === "candidate";

  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleSelect(newRole: Role) {
    if (newRole === role) return;
    setError(null);
    setSuccessMsg(null);

    if (
      newRole === "candidate" &&
      membership.currentCandidateMembershipId &&
      membership.currentCandidateName
    ) {
      onRequestTransfer(
        membership.currentCandidateMembershipId,
        membership.currentCandidateName
      );
    } else {
      setPendingRole(newRole);
    }
  }

  async function handleConfirm() {
    if (!pendingRole) return;
    setSaving(true);
    setError(null);
    const result = await adminChangeUserRoleFromUserPanel(
      membership.id,
      pendingRole as import("@prisma/client").Role
    );
    setSaving(false);
    if (result.error) {
      setError(result.error);
      setPendingRole(null);
      return;
    }
    setPendingRole(null);
    setSuccessMsg("Updated");
    setTimeout(() => setSuccessMsg(null), 2500);
    onChanged();
  }

  return (
    <tr className={isDeleted ? "opacity-40" : ""}>
      <td className="px-5 py-3">
        <Link
          href={`/admin/campaigns/${membership.campaign.id}`}
          className="font-medium text-slate-900 hover:text-brand-600 transition-colors"
        >
          {membership.campaign.name}
        </Link>
        <p className="text-xs text-slate-400 mt-0.5">
          {membership.campaign.municipality ?? membership.campaign.city}
        </p>
      </td>
      <td className="px-5 py-3">
        {!isDeleted && !isCandidate ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <select
                value={pendingRole ?? role}
                onChange={(e) => handleSelect(e.target.value as Role)}
                disabled={saving}
                className={selectCls + " disabled:opacity-60"}
              >
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              {saving && (
                <svg
                  className="h-4 w-4 text-slate-400 animate-spin flex-shrink-0"
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

            {pendingRole && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-500">
                  Change to <strong>{ROLE_LABELS[pendingRole]}</strong>?
                </span>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="h-6 px-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                >
                  {saving ? "…" : "Confirm"}
                </button>
                <button
                  onClick={() => setPendingRole(null)}
                  disabled={saving}
                  className="h-6 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>

                {successMsg && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-600 rounded-full px-2 py-0.5">
                    {successMsg}
                  </span>
                )}
              </div>
            )}

            {!pendingRole && successMsg && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-600 rounded-full px-2 py-0.5 self-start">
                {successMsg}
              </span>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        ) : (
          <div>
            <span
              className={[
                "text-sm",
                isCandidate ? "font-semibold text-brand-700" : "text-slate-600",
              ].join(" ")}
            >
              {ROLE_LABELS[role] ?? role}
            </span>
            {isCandidate && !isDeleted && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Transfer via{" "}
                <Link
                  href={`/admin/campaigns/${membership.campaign.id}`}
                  className="text-brand-500 hover:underline"
                >
                  campaign panel
                </Link>
              </p>
            )}
          </div>
        )}
      </td>
      <td className="px-5 py-3 hidden md:table-cell text-slate-400 tabular-nums">
        {new Date(membership.createdAt).toLocaleDateString("en-CA", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </td>
    </tr>
  );
}

// ── Transfer modal ─────────────────────────────────────────────────────────────

function UserTransferModal({
  currentCandidateName,
  saving,
  error,
  onConfirm,
  onCancel,
}: {
  currentCandidateName: string;
  saving: boolean;
  error: string | null;
  onConfirm: (formerRole: import("@prisma/client").Role) => void;
  onCancel: () => void;
}) {
  const [formerRole, setFormerRole] = useState<Role>("campaign_manager");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Transfer candidate role
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          This user will become the new candidate for this campaign.
        </p>

        <div className="mb-5">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">
            What role should <strong>{currentCandidateName}</strong> take on?
          </label>
          <select
            value={formerRole}
            onChange={(e) => setFormerRole(e.target.value as Role)}
            className={selectCls + " w-full"}
          >
            {NON_CANDIDATE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => onConfirm(formerRole as import("@prisma/client").Role)}
            disabled={saving}
            className="flex-1 h-9 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? "Transferring…" : "Confirm transfer"}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 h-9 px-4 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
