"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Role } from "@/types";
import { ROLE_LABELS } from "@/types";
import { changeUserRole, transferCandidateRole } from "./role-actions";
import { TeamMemberClassifyModal } from "./classify-modal";
import { getTeamMembers, getRemovedMembers, addTeamMember, removeTeamMember, restoreTeamMember } from "./actions";
import { AddressPicker } from "@/components/ui/address-picker";
import type { AddressPickerResult } from "@/components/ui/address-picker";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamMember {
  membershipId: string;
  personId: string | null;
  role: Role;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneHome: string | null;
    phoneMobile: string | null;
    isActive: boolean;
    createdAt: string;
  };
}

interface RemovedMember {
  membershipId: string;
  role: Role;
  removedAt: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
}

// ── Role ordering + helpers ───────────────────────────────────────────────────

const ROLE_ORDER: Role[] = [
  "candidate",
  "campaign_manager",
  "data_manager",
  "co_chair",
  "field_organizer",
  "volunteer_coordinator",
  "canvasser",
  "sign_installer",
  "finance_lead",
];

const ALL_ASSIGNABLE_ROLES: Role[] = [
  "data_manager",
  "co_chair",
  "field_organizer",
  "volunteer_coordinator",
  "canvasser",
  "sign_installer",
  "finance_lead",
];

const NON_CANDIDATE_ROLES: Role[] = ROLE_ORDER.filter((r) => r !== "candidate");

const ROLE_BADGE: Record<Role, string> = {
  candidate:             "bg-brand-50 text-brand-700 border-brand-200",
  campaign_manager:      "bg-slate-800 text-white border-slate-800",
  data_manager:          "bg-slate-700 text-white border-slate-700",
  co_chair:              "bg-purple-50 text-purple-700 border-purple-200",
  field_organizer:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  volunteer_coordinator: "bg-teal-50 text-teal-700 border-teal-200",
  canvasser:             "bg-sky-50 text-sky-700 border-sky-200",
  sign_installer:        "bg-orange-50 text-orange-700 border-orange-200",
  finance_lead:          "bg-amber-50 text-amber-700 border-amber-200",
  data_supplier:         "bg-slate-100 text-slate-500 border-slate-200",
};

function sortMembers(members: TeamMember[]): TeamMember[] {
  return [...members].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  "h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500";
const selectCls =
  "h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500";
const primaryBtn =
  "h-9 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { data: session, status: sessionStatus } = useSession();
  const activeRole = session?.user?.activeRole as Role | undefined;
  const currentUserId = session?.user?.id;

  const canManage = activeRole === "candidate" || activeRole === "campaign_manager" || activeRole === "data_manager";
  const viewerIsCandidate = activeRole === "candidate";
  const isFieldOrganizer = activeRole === "field_organizer";
  // Only candidate and campaign_manager can assign the data_manager role
  const canAssignDataManager = activeRole === "candidate" || activeRole === "campaign_manager";
  // field_organizer can add canvasser and sign_installer but cannot remove or manage other roles
  const canAddMember = canManage || isFieldOrganizer;

  // candidate sees all roles; field_organizer limited to canvasser/sign_installer;
  // campaign_manager/data_manager see all except candidate (data_manager cannot assign data_manager)
  const dropdownRoles: Role[] = viewerIsCandidate
    ? ROLE_ORDER
    : isFieldOrganizer
    ? (["canvasser", "sign_installer"] as Role[])
    : ROLE_ORDER.filter((r) => r !== "candidate" && (canAssignDataManager || r !== "data_manager"));

  // roles usable in the "add member" form — never includes candidate
  const addableRoles: Role[] = viewerIsCandidate
    ? ["campaign_manager", ...ALL_ASSIGNABLE_ROLES]
    : isFieldOrganizer
    ? (["canvasser", "sign_installer"] as Role[])
    : canAssignDataManager
    ? ALL_ASSIGNABLE_ROLES
    : ALL_ASSIGNABLE_ROLES.filter((r) => r !== "data_manager");

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [removedMembers, setRemovedMembers] = useState<RemovedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);

  async function loadMembers() {
    setLoading(true);
    setFetchError(null);
    try {
      const [activeResult, removedResult] = await Promise.all([
        getTeamMembers(),
        getRemovedMembers(),
      ]);
      if (activeResult.error) throw new Error(activeResult.error);
      setMembers(sortMembers(activeResult.members ?? []));
      if (!removedResult.error) setRemovedMembers(removedResult.members ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  if (loading || sessionStatus === "loading") {
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

  const candidateMember = members.find((m) => m.role === "candidate");

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
        {canAddMember && (
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
      {showAddForm && canAddMember && (
        <AddMemberForm
          assignableRoles={addableRoles}
          onSuccess={() => {
            setShowAddForm(false);
            loadMembers();
          }}
        />
      )}

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
              viewerIsCandidate={viewerIsCandidate}
              isFieldOrganizer={isFieldOrganizer}
              dropdownRoles={dropdownRoles}
              currentCandidateMembershipId={candidateMember?.membershipId}
              currentCandidateName={
                candidateMember
                  ? `${candidateMember.user.firstName} ${candidateMember.user.lastName}`
                  : undefined
              }
              onChanged={loadMembers}
            />
          ))}
        </div>
      )}

      {/* Removed members */}
      {canManage && removedMembers.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowRemoved((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 hover:text-slate-600 transition-colors"
          >
            <svg
              className={["h-3.5 w-3.5 transition-transform", showRemoved ? "rotate-90" : ""].join(" ")}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Removed members ({removedMembers.length})
          </button>

          {showRemoved && (
            <div className="flex flex-col gap-2">
              {removedMembers.map((m) => (
                <RemovedMemberRow key={m.membershipId} member={m} onRestored={loadMembers} />
              ))}
            </div>
          )}
        </div>
      )}

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
  const [classifyTarget, setClassifyTarget] = useState<{
    personId: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  // Controlled address state for picker fill-through
  const [addrStreetNumber, setAddrStreetNumber] = useState("");
  const [addrStreetName, setAddrStreetName] = useState("");
  const [addrUnitNumber, setAddrUnitNumber] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrProvince, setAddrProvince] = useState("ON");
  const [addrPostalCode, setAddrPostalCode] = useState("");
  const [addrLat, setAddrLat] = useState<number | null>(null);
  const [addrLng, setAddrLng] = useState<number | null>(null);

  function handleAddressPick(result: AddressPickerResult | null) {
    if (!result) {
      setAddrStreetNumber(""); setAddrStreetName(""); setAddrCity(""); setAddrProvince("ON"); setAddrPostalCode("");
      setAddrLat(null); setAddrLng(null);
      return;
    }
    if (result.type === "campaign") {
      setAddrStreetNumber(result.streetNumber); setAddrStreetName(result.streetName);
      setAddrUnitNumber(result.unitNumber ?? ""); setAddrCity(result.city);
      setAddrProvince(result.province); setAddrPostalCode(result.postalCode);
      setAddrLat(null); setAddrLng(null);
    } else if (result.type === "mapbox") {
      setAddrStreetNumber(result.streetNumber); setAddrStreetName(result.streetName);
      setAddrCity(result.city); setAddrProvince(result.province); setAddrPostalCode(result.postalCode);
      setAddrLat(result.latitude); setAddrLng(result.longitude);
    } else {
      setAddrStreetNumber(result.streetNumber); setAddrStreetName(result.streetName);
      setAddrUnitNumber(result.unitNumber ?? ""); setAddrCity(result.city);
      setAddrProvince(result.province); setAddrPostalCode(result.postalCode);
      setAddrLat(null); setAddrLng(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const firstNameVal = (fd.get("firstName") as string).trim();
    const lastNameVal = (fd.get("lastName") as string).trim();
    try {
      const result = await addTeamMember({
        firstName: firstNameVal,
        lastName: lastNameVal,
        email: fd.get("email") as string,
        phoneHome: (fd.get("phoneHome") as string).trim() || null,
        phoneMobile: (fd.get("phoneMobile") as string).trim() || null,
        role: fd.get("role") as string,
        skipVerification: fd.get("skipVerification") === "on",
        streetNumber: addrStreetNumber.trim() || null,
        streetName: addrStreetName.trim() || null,
        unitNumber: addrUnitNumber.trim() || null,
        city: addrCity.trim() || null,
        province: addrProvince.trim() || null,
        postalCode: addrPostalCode.trim() || null,
        lat: addrLat,
        lng: addrLng,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.personId) {
        setClassifyTarget({ personId: result.personId, firstName: firstNameVal, lastName: lastNameVal });
      } else {
        onSuccess();
      }
    } catch {
      setError("Failed to add member — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {classifyTarget && (
        <TeamMemberClassifyModal
          personId={classifyTarget.personId}
          name={`${classifyTarget.firstName} ${classifyTarget.lastName}`}
          onDone={() => {
            setClassifyTarget(null);
            onSuccess();
          }}
        />
      )}
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
            <label className="text-xs font-medium text-slate-500">Home phone</label>
            <input name="phoneHome" type="tel" className={inputCls + " w-full"} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">Mobile phone</label>
            <input name="phoneMobile" type="tel" className={inputCls + " w-full"} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500">Address <span className="text-slate-400 font-normal">(optional)</span></label>
          <AddressPicker onSelect={handleAddressPick} compact />
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-1">
              <input
                value={addrStreetNumber}
                onChange={e => { setAddrStreetNumber(e.target.value); setAddrLat(null); setAddrLng(null); }}
                placeholder="Street #"
                className={inputCls + " w-full"}
              />
            </div>
            <div className="col-span-2">
              <input
                value={addrStreetName}
                onChange={e => { setAddrStreetName(e.target.value); setAddrLat(null); setAddrLng(null); }}
                placeholder="Street name"
                className={inputCls + " w-full"}
              />
            </div>
            <div className="col-span-1">
              <input
                value={addrUnitNumber}
                onChange={e => setAddrUnitNumber(e.target.value)}
                placeholder="Unit"
                className={inputCls + " w-full"}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <input
                value={addrCity}
                onChange={e => { setAddrCity(e.target.value); setAddrLat(null); setAddrLng(null); }}
                placeholder="City"
                className={inputCls + " w-full"}
              />
            </div>
            <div className="col-span-1">
              <input
                value={addrProvince}
                onChange={e => setAddrProvince(e.target.value)}
                placeholder="ON"
                maxLength={2}
                className={inputCls + " w-full uppercase"}
              />
            </div>
            <div className="col-span-1">
              <input
                value={addrPostalCode}
                onChange={e => { setAddrPostalCode(e.target.value); setAddrLat(null); setAddrLng(null); }}
                placeholder="A1A 1A1"
                className={inputCls + " w-full uppercase"}
              />
            </div>
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

        <div className="flex items-start gap-2 pt-1">
          <input
            type="checkbox"
            id="skipVerification"
            name="skipVerification"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="skipVerification" className="text-xs text-slate-500 leading-relaxed">
            Skip email verification — member can sign in immediately with the temporary password
          </label>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? "Adding…" : "Add member"}
          </button>
        </div>
      </form>
    </div>
    </>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────

const FIELD_ORG_EDITABLE_ROLES: Role[] = ["canvasser", "sign_installer"];

function MemberRow({
  member,
  isCurrentUser,
  canManage,
  viewerIsCandidate,
  isFieldOrganizer,
  dropdownRoles,
  currentCandidateMembershipId,
  currentCandidateName,
  onChanged,
}: {
  member: TeamMember;
  isCurrentUser: boolean;
  canManage: boolean;
  viewerIsCandidate: boolean;
  isFieldOrganizer: boolean;
  dropdownRoles: Role[];
  currentCandidateMembershipId: string | undefined;
  currentCandidateName: string | undefined;
  onChanged: () => void;
}) {
  const memberIsCandidate = member.role === "candidate";

  // candidate can edit any non-self row; campaign_manager can edit non-candidate non-self rows;
  // field_organizer can only edit canvasser and sign_installer rows
  const canEdit =
    !isCurrentUser &&
    (viewerIsCandidate ||
      (canManage && !memberIsCandidate) ||
      (isFieldOrganizer && FIELD_ORG_EDITABLE_ROLES.includes(member.role)));

  const canRemove = canManage && !memberIsCandidate && !isCurrentUser;

  // pending role = the role the user has selected but not yet confirmed
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  function handleSelect(newRole: Role) {
    if (newRole === member.role) return;
    setError(null);
    setSuccessMsg(null);
    if (newRole === "candidate") {
      // Candidate transfer — requires a modal to choose former candidate's new role
      setShowTransferModal(true);
    } else {
      setPendingRole(newRole);
    }
  }

  async function handleConfirmChange() {
    if (!pendingRole) return;
    setSaving(true);
    setError(null);
    const result = await changeUserRole(member.membershipId, pendingRole as import("@prisma/client").Role);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      setPendingRole(null);
      return;
    }
    setPendingRole(null);
    setSuccessMsg("Role updated");
    setTimeout(() => setSuccessMsg(null), 2500);
    onChanged();
  }

  function handleCancelChange() {
    setPendingRole(null);
  }

  async function handleConfirmTransfer(formerCandidateNewRole: import("@prisma/client").Role) {
    if (!currentCandidateMembershipId) return;
    setSaving(true);
    setError(null);
    const result = await transferCandidateRole(
      currentCandidateMembershipId,
      member.membershipId,
      formerCandidateNewRole
    );
    setSaving(false);
    setShowTransferModal(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onChanged();
  }

  async function handleRemove() {
    setRemoving(true);
    setRemoveError(null);
    try {
      const result = await removeTeamMember(member.user.id);
      if (result?.error) {
        setRemoveError(result.error);
        setConfirmRemove(false);
        return;
      }
      onChanged();
    } catch {
      setRemoveError("Failed to remove member");
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  return (
    <>
      {showTransferModal && currentCandidateName && (
        <TransferModal
          incomingName={`${member.user.firstName} ${member.user.lastName}`}
          currentCandidateName={currentCandidateName}
          saving={saving}
          onConfirm={handleConfirmTransfer}
          onCancel={() => setShowTransferModal(false)}
        />
      )}

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
              {successMsg && (
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-600 rounded-full px-2 py-0.5">
                  {successMsg}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">{member.user.email}</p>
            {member.user.phoneHome && (
              <p className="text-xs text-slate-400">{member.user.phoneHome}</p>
            )}
            {member.user.phoneMobile && (
              <p className="text-xs text-slate-400">{member.user.phoneMobile}</p>
            )}
            {member.personId && (
              <Link
                href={`/people/${member.personId}`}
                className="inline-block mt-0.5 text-xs text-brand-600 hover:underline"
              >
                View record
              </Link>
            )}
          </div>

          {/* Role — editable dropdown or static badge */}
          <div className="flex-shrink-0">
            {canEdit ? (
              <div className="flex items-center gap-1.5">
                <select
                  value={pendingRole ?? member.role}
                  onChange={(e) => handleSelect(e.target.value as Role)}
                  disabled={saving}
                  className={selectCls + " disabled:opacity-60"}
                  aria-label="Change role"
                >
                  {dropdownRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                {saving && (
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

        {/* Inline role change confirmation */}
        {pendingRole && (
          <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 flex-1">
              Change role to <strong>{ROLE_LABELS[pendingRole]}</strong>?
            </span>
            <button
              onClick={handleConfirmChange}
              disabled={saving}
              className="h-7 px-3 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Confirm"}
            </button>
            <button
              onClick={handleCancelChange}
              disabled={saving}
              className="h-7 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Inline errors */}
        {(error || removeError) && (
          <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
            {error ?? removeError}
          </p>
        )}
      </div>
    </>
  );
}

// ── Transfer modal ────────────────────────────────────────────────────────────

function TransferModal({
  incomingName,
  currentCandidateName,
  saving,
  onConfirm,
  onCancel,
}: {
  incomingName: string;
  currentCandidateName: string;
  saving: boolean;
  onConfirm: (formerRole: import("@prisma/client").Role) => void;
  onCancel: () => void;
}) {
  const [formerRole, setFormerRole] = useState<Role>("campaign_manager");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6">
        <h2 className="text-base font-bold text-slate-900 mb-1">Transfer candidate role</h2>
        <p className="text-sm text-slate-500 mb-5">
          <strong>{incomingName}</strong> will become the new candidate for this campaign.
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
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onConfirm(formerRole as import("@prisma/client").Role)}
            disabled={saving}
            className={primaryBtn + " flex-1"}
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

// ── Removed member row ────────────────────────────────────────────────────────

function RemovedMemberRow({
  member,
  onRestored,
}: {
  member: RemovedMember;
  onRestored: () => void;
}) {
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    setRestoring(true);
    setError(null);
    try {
      const result = await restoreTeamMember(member.user.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onRestored();
    } catch {
      setError("Failed to restore member — please try again");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-100 px-4 py-3 opacity-70">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-slate-400">
            {member.user.firstName[0]}{member.user.lastName[0]}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-500">
            {member.user.firstName} {member.user.lastName}
          </p>
          <p className="text-xs text-slate-400 truncate">{member.user.email}</p>
        </div>

        <RoleBadge role={member.role} />

        <button
          onClick={handleRestore}
          disabled={restoring}
          className="flex-shrink-0 h-8 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-brand-600 hover:border-brand-300 transition-colors disabled:opacity-50"
        >
          {restoring ? "Restoring…" : "Restore"}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          {error}
        </p>
      )}
    </div>
  );
}
