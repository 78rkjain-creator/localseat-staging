"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { Role } from "@/types";
import { ROLE_LABELS } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMember {
  membershipId: string;
  role: Role;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    createdAt: string;
  };
}

// ── Role ordering + helpers ───────────────────────────────────────────────────

const ROLE_ORDER: Role[] = [
  "candidate",
  "campaign_manager",
  "co_chair",
  "field_organizer",
  "volunteer_coordinator",
  "canvasser",
  "finance_lead",
];

const ALL_ASSIGNABLE_ROLES: Role[] = [
  "co_chair",
  "field_organizer",
  "volunteer_coordinator",
  "canvasser",
  "finance_lead",
];

const ROLE_BADGE: Record<Role, string> = {
  candidate:             "bg-brand-50 text-brand-700 border-brand-200",
  campaign_manager:      "bg-slate-800 text-white border-slate-800",
  co_chair:              "bg-purple-50 text-purple-700 border-purple-200",
  field_organizer:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  volunteer_coordinator: "bg-teal-50 text-teal-700 border-teal-200",
  canvasser:             "bg-sky-50 text-sky-700 border-sky-200",
  finance_lead:          "bg-amber-50 text-amber-700 border-amber-200",
};

function sortMembers(members: TeamMember[]): TeamMember[] {
  return [...members].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  );
}

// ── Shared input/button styles ────────────────────────────────────────────────

const inputCls =
  "h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500";
const selectCls =
  "h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500";
const primaryBtn =
  "h-9 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { data: session } = useSession();
  const activeRole = session?.user?.activeRole as Role | undefined;
  const currentUserId = session?.user?.id;

  const canManage = activeRole === "candidate" || activeRole === "campaign_manager";
  const isCandidate = activeRole === "candidate";
  const isFieldOrganizer = activeRole === "field_organizer";

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  async function loadMembers() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error(await res.text());
      const data: TeamMember[] = await res.json();
      setMembers(sortMembers(data));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
        <div className="h-8 w-32 bg-slate-100 rounded-xl animate-pulse mb-6" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {fetchError}
        </p>
      </div>
    );
  }

  const assignableRoles: Role[] = isCandidate
    ? ["campaign_manager", ...ALL_ASSIGNABLE_ROLES]
    : ALL_ASSIGNABLE_ROLES;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className={primaryBtn + " inline-flex items-center gap-1.5"}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {showAddForm ? "Cancel" : "Add member"}
          </button>
        )}
      </div>

      {/* Add member form */}
      {showAddForm && canManage && (
        <AddMemberForm
          assignableRoles={assignableRoles}
          onSuccess={() => {
            setShowAddForm(false);
            loadMembers();
          }}
        />
      )}

      {/* Scoped view label for field organizer */}
      {isFieldOrganizer && members.length > 0 && (
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
          Your team
        </p>
      )}

      {/* Member list */}
      {members.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-5 py-10 text-center">
          <p className="text-sm text-slate-400">No team members yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <MemberRow
              key={m.membershipId}
              member={m}
              isCurrentUser={m.user.id === currentUserId}
              canManage={canManage}
              assignableRoles={assignableRoles}
              onChanged={loadMembers}
            />
          ))}
        </div>
      )}

      {/* New accounts note */}
      {canManage && (
        <p className="mt-6 text-xs text-slate-400">
          New accounts use a temporary password of{" "}
          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">password</span>
          . Ask members to change it after first sign-in.
        </p>
      )}
    </div>
  );
}

// ── Add member form ───────────────────────────────────────────────────────────

function AddMemberForm({
  assignableRoles,
  onSuccess,
}: {
  assignableRoles: Role[];
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const phone = (fd.get("phone") as string).trim();
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: fd.get("firstName"),
          lastName: fd.get("lastName"),
          email: fd.get("email"),
          phone: phone || null,
          role: fd.get("role"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setError(body.error ?? "Failed to add member");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 mb-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Add team member</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">
              First name <span className="text-red-500">*</span>
            </label>
            <input name="firstName" required className={inputCls + " w-full"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">
              Last name <span className="text-red-500">*</span>
            </label>
            <input name="lastName" required className={inputCls + " w-full"} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">
              Email <span className="text-red-500">*</span>
            </label>
            <input name="email" type="email" required className={inputCls + " w-full"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">Phone</label>
            <input name="phone" type="tel" className={inputCls + " w-full"} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500">
            Role <span className="text-red-500">*</span>
          </label>
          <select name="role" required defaultValue="" className={selectCls + " w-full"}>
            <option value="" disabled>Select a role…</option>
            {assignableRoles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? "Adding…" : "Add member"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  isCurrentUser,
  canManage,
  assignableRoles,
  onChanged,
}: {
  member: TeamMember;
  isCurrentUser: boolean;
  canManage: boolean;
  assignableRoles: Role[];
  onChanged: () => void;
}) {
  const isCandidate = member.role === "candidate";
  const canEdit = canManage && !isCandidate;
  const canRemove = canManage && !isCandidate && !isCurrentUser;

  const [roleValue, setRoleValue] = useState<Role>(member.role);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleRoleChange(newRole: Role) {
    setRoleValue(newRole);
    setRoleError(null);
    setSavingRole(true);
    try {
      const res = await fetch(`/api/team/${member.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setRoleError(body.error ?? "Failed to update role");
        setRoleValue(member.role);
        return;
      }
      onChanged();
    } catch {
      setRoleError("Network error");
      setRoleValue(member.role);
    } finally {
      setSavingRole(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch(`/api/team/${member.user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setRemoveError(body.error ?? "Failed to remove member");
        setConfirmRemove(false);
        return;
      }
      onChanged();
    } catch {
      setRemoveError("Network error");
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-slate-500">
            {member.user.firstName[0]}{member.user.lastName[0]}
          </span>
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900">
              {member.user.firstName} {member.user.lastName}
            </span>
            {isCurrentUser && (
              <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                you
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate">{member.user.email}</p>
          {member.user.phone && (
            <p className="text-xs text-slate-400">{member.user.phone}</p>
          )}
        </div>

        {/* Role — editable select or static badge */}
        <div className="flex-shrink-0">
          {canEdit ? (
            <div className="flex items-center gap-1.5">
              <select
                value={roleValue}
                onChange={(e) => handleRoleChange(e.target.value as Role)}
                disabled={savingRole}
                className={selectCls + " disabled:opacity-60"}
                aria-label="Change role"
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              {savingRole && (
                <svg className="h-4 w-4 text-slate-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
            </div>
          ) : (
            <RoleBadge role={member.role} />
          )}
        </div>

        {/* Remove button */}
        {canRemove && (
          <div className="flex-shrink-0">
            {!confirmRemove ? (
              <button
                onClick={() => setConfirmRemove(true)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                aria-label="Remove member"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Remove?</span>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="h-7 px-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                >
                  {removing ? "…" : "Yes"}
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="h-7 px-2 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  No
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline errors */}
      {(roleError || removeError) && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          {roleError ?? removeError}
        </p>
      )}
    </div>
  );
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${ROLE_BADGE[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
