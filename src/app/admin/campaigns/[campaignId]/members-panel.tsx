"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/types";
import { ROLE_LABELS } from "@/types";
import { adminChangeUserRole, adminTransferCandidateRole } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminMemberEntry {
  id: string;
  role: string;
  deletedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
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

export function MembersPanel({
  campaignId,
  members,
}: {
  campaignId: string;
  members: AdminMemberEntry[];
}) {
  const router = useRouter();

  // Transfer modal state lives at panel level so it renders outside the table
  const [transferTarget, setTransferTarget] = useState<AdminMemberEntry | null>(null);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const candidateMember = members.find((m) => m.role === "candidate" && !m.deletedAt);

  async function handleTransferConfirm(formerCandidateNewRole: import("@prisma/client").Role) {
    if (!transferTarget || !candidateMember) return;
    setTransferSaving(true);
    setTransferError(null);
    const result = await adminTransferCandidateRole(
      campaignId,
      candidateMember.id,
      transferTarget.id,
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
      {/* Transfer modal — rendered outside table to avoid invalid DOM nesting */}
      {transferTarget && candidateMember && (
        <AdminTransferModal
          incomingName={`${transferTarget.user.firstName} ${transferTarget.user.lastName}`}
          currentCandidateName={`${candidateMember.user.firstName} ${candidateMember.user.lastName}`}
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
              Name
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">
              Email
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Role
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">
              Joined
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {members.map((m) => (
            <AdminMemberRow
              key={m.id}
              member={m}
              campaignId={campaignId}
              hasCandidateContext={!!candidateMember}
              onRequestTransfer={() => setTransferTarget(m)}
              onChanged={() => router.refresh()}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function AdminMemberRow({
  member,
  campaignId,
  hasCandidateContext,
  onRequestTransfer,
  onChanged,
}: {
  member: AdminMemberEntry;
  campaignId: string;
  hasCandidateContext: boolean;
  onRequestTransfer: () => void;
  onChanged: () => void;
}) {
  const role = member.role as Role;
  const isDeleted = !!member.deletedAt;
  const isCandidate = role === "candidate";

  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleSelect(newRole: Role) {
    if (newRole === role) return;
    setError(null);
    setSuccessMsg(null);

    if (newRole === "candidate" && hasCandidateContext) {
      // Candidate already exists — require explicit transfer flow
      onRequestTransfer();
    } else {
      setPendingRole(newRole);
    }
  }

  async function handleConfirm() {
    if (!pendingRole) return;
    setSaving(true);
    setError(null);
    const result = await adminChangeUserRole(
      campaignId,
      member.id,
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
      <td className="px-5 py-3 font-medium text-slate-900">
        {member.user.firstName} {member.user.lastName}
        {successMsg && (
          <span className="ml-2 inline-flex items-center text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-600 rounded-full px-2 py-0.5">
            {successMsg}
          </span>
        )}
      </td>
      <td className="px-5 py-3 hidden md:table-cell text-slate-500 truncate max-w-[200px]">
        {member.user.email}
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
              <div className="flex items-center gap-1.5">
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
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        ) : (
          <span
            className={[
              "text-sm",
              isCandidate ? "font-semibold text-brand-700" : "text-slate-600",
            ].join(" ")}
          >
            {ROLE_LABELS[role] ?? role}
            {isCandidate && (
              <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-brand-400">
                — transfer via panel below
              </span>
            )}
          </span>
        )}
      </td>
      <td className="px-5 py-3 hidden lg:table-cell text-slate-400 tabular-nums">
        {new Date(member.createdAt).toLocaleDateString("en-CA", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </td>
    </tr>
  );
}

// ── Transfer modal ─────────────────────────────────────────────────────────────

function AdminTransferModal({
  incomingName,
  currentCandidateName,
  saving,
  error,
  onConfirm,
  onCancel,
}: {
  incomingName: string;
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
          <strong>{incomingName}</strong> will become the new candidate for this
          campaign.
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
