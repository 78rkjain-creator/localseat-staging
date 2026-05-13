"use client";

import Link from "next/link";
import { Navigation, Home, Smartphone, MessageSquare } from "lucide-react";
import type { CanvassState, LocalEntry } from "./use-canvass-state";
import {
  SCALE_BUTTONS,
  NOT_HOME_OUTCOMES,
  UNDECIDED_SUB_OPTIONS,
  haversineKm,
  formatVisitDate,
  fmtApptBadge,
  emptyDraft,
} from "./use-canvass-state";
import type { SupportLevel } from "@/types";
import { SUPPORT_LEVEL_LABELS } from "@/types";
import { VoterChangeModal } from "@/components/voter-change-modal";
import { AddResidentModal } from "@/components/add-resident-modal";

// ── Compact toggle ────────────────────────────────────────────────────────

function CompactToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full h-11 flex items-center justify-between px-4 hover:bg-slate-50 active:bg-slate-100 transition-colors"
    >
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <div
        className={[
          "relative h-6 w-10 rounded-full transition-colors flex-shrink-0",
          checked ? "bg-brand-500" : "bg-slate-200",
        ].join(" ")}
      >
        <div
          className={[
            "absolute top-0.5 h-5 w-5 bg-white rounded-full shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          ].join(" ")}
        />
      </div>
    </button>
  );
}

// ── Main tab component ────────────────────────────────────────────────────

interface TabCanvassProps {
  state: CanvassState;
}

export function TabCanvass({ state }: TabCanvassProps) {
  const {
    entries,
    currentIndex,
    draft,
    setDraft,
    isPending,
    error,
    current,
    displayEntries,
    totalCount,
    doneCount,
    progressPct,
    savedSet,
    selectedPersonId,
    setSelectedPersonId,
    appointmentsByPersonId,
    competitors,
    isUndecided,
    isNoLevel,
    canSave,
    saveHint,
    saveFlash,
    showNotHomeMenu,
    setShowNotHomeMenu,
    showEditConfirm,
    setShowEditConfirm,
    showAddResidentConfirm,
    setShowAddResidentConfirm,
    showVoterChangeModal,
    setShowVoterChangeModal,
    showAddResidentModal,
    setShowAddResidentModal,
    parityFilter,
    setParityFilter,
    sortMode,
    setSortMode,
    setCurrentIndex,
    gpsError,
    campaignId,
    campaignCity,
    sessionStartTime,
    preSavedIds,
    sessionStats,
    listName,
    handleSave,
    handleNotHomeSave,
    handleSkip,
    handlePrevious,
    done,
    activeSurvey,
    surveyAnswers,
  } = state;

  // ── Done / Shift summary screen ────────────────────────────────────────

  if (done || entries.length === 0) {
    const sessionDoors = Array.from(savedSet).filter((id) => !preSavedIds.has(id)).length;
    const sessionMinutes = Math.round((Date.now() - sessionStartTime.getTime()) / 60000);
    const sessionHours = Math.floor(sessionMinutes / 60);
    const sessionMins = sessionMinutes % 60;
    const timeLabel = sessionHours > 0 ? `${sessionHours}h ${sessionMins}m` : `${sessionMins}m`;
    const doorsPerHour = sessionMinutes > 0 ? Math.round((sessionDoors / sessionMinutes) * 60) : 0;
    const { contacted, notHome, supportYes, signs, volunteers } = sessionStats;

    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-6">
        {entries.length === 0 ? (
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-6 mx-auto">
              <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">No people on this list</h1>
            <p className="text-slate-500 text-sm mb-8">The list doesn&apos;t have any entries yet.</p>
            <Link href="/canvassing" className="inline-flex items-center gap-2 h-12 px-6 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-2xl text-sm transition-colors">
              Back to my lists
            </Link>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
              <div className="px-6 pt-6 pb-4 text-center" style={{ background: "linear-gradient(135deg, #065f46, #047857)" }}>
                <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-white">Shift complete</h1>
                <p className="text-emerald-200 text-sm mt-1">Great work out there.</p>
              </div>
              <div className="px-6 py-5">
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{sessionDoors}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Doors</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{timeLabel}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Time</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{doorsPerHour}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Per hour</p>
                  </div>
                </div>
                {sessionDoors > 0 && (
                  <div className="space-y-2">
                    {contacted > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Contacted</span>
                        <span className="font-semibold text-slate-900">{contacted}</span>
                      </div>
                    )}
                    {notHome > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Not home / other</span>
                        <span className="font-semibold text-slate-900">{notHome}</span>
                      </div>
                    )}
                    {supportYes > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-emerald-600">Supporters found</span>
                        <span className="font-semibold text-emerald-700">{supportYes}</span>
                      </div>
                    )}
                    {signs > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Sign requests</span>
                        <span className="font-semibold text-slate-900">{signs}</span>
                      </div>
                    )}
                    {volunteers > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Volunteer interest</span>
                        <span className="font-semibold text-slate-900">{volunteers}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span>List progress</span>
                    <span className="font-semibold tabular-nums">{doneCount}/{totalCount}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/dashboard" className="flex items-center justify-center h-12 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-2xl text-sm transition-colors">
                Back to dashboard
              </Link>
              <Link href="/canvassing" className="flex items-center justify-center h-12 border border-slate-200 bg-white text-slate-700 font-medium rounded-2xl text-sm hover:bg-slate-50 transition-colors">
                My walk lists
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Active canvassing form ─────────────────────────────────────────────

  const addr = current?.person.address;
  const addressLine = addr
    ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
    : "Unknown address";
  const cityLine = addr ? `${addr.city}, ${addr.province}` : "";
  const coResidents = current?.person.coResidents ?? [];

  const buildingBaseKey = addr ? `${addr.streetNumber} ${addr.streetName}` : null;
  const buildingEntries = buildingBaseKey
    ? entries.filter(e => {
        const a = e.person.address;
        return a && `${a.streetNumber} ${a.streetName}` === buildingBaseKey;
      })
    : [];
  const isMultiUnit = buildingEntries.length > 1;
  const buildingPosition = isMultiUnit
    ? buildingEntries.findIndex(e => e.person.id === current?.person.id) + 1
    : 0;

  function fmtAddr(a: typeof addr): string {
    if (!a) return "";
    return `${a.streetNumber} ${a.streetName}${a.unitNumber ? ` #${a.unitNumber}` : ""}, ${a.city}, ${a.province}`;
  }

  const mapsUrl = addr
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fmtAddr(addr))}&travelmode=walking`
    : null;

  const nextEntry = displayEntries[currentIndex + 1] ?? null;
  const nextAddr = nextEntry?.person?.address ?? null;
  const isLastEntry = currentIndex >= displayEntries.length - 1;
  const walkMinutes = (() => {
    if (!addr?.lat || !addr?.lng || !nextAddr?.lat || !nextAddr?.lng) return null;
    const km = haversineKm(addr.lat, addr.lng, nextAddr.lat, nextAddr.lng);
    return Math.max(1, Math.round((km / 5) * 60));
  })();

  const allResidents = current ? [
    { id: current.person.id, firstName: current.person.firstName, lastName: current.person.lastName },
    ...coResidents,
  ] : [];

  // No entries after filter
  if (displayEntries.length === 0 && entries.length > 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <p className="text-slate-500 text-sm">No {parityFilter} addresses on this list.</p>
          <button
            type="button"
            onClick={() => setParityFilter("all")}
            className="mt-2 text-brand-600 text-sm font-medium"
          >
            Show all addresses
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  // Determine outcome mode for the form
  const outcomeMode = draft.otherOutcome === "refused"
    ? "refused"
    : (draft.otherOutcome && draft.otherOutcome !== "contacted" && draft.otherOutcome !== "other_candidate")
      ? "not_home"
      : "spoke";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sort & filter bar */}
      <div className="flex-none bg-white border-b border-slate-100 px-4 py-1.5 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex-shrink-0">Sort</span>
        <button
          type="button"
          onClick={() => { setSortMode("default"); setCurrentIndex(0); }}
          className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors flex-shrink-0 ${
            sortMode === "default"
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          Address
        </button>
        <button
          type="button"
          onClick={() => { setSortMode("nearest"); setCurrentIndex(0); }}
          className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors flex-shrink-0 ${
            sortMode === "nearest"
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          Nearest
        </button>
        <span className="w-px h-4 bg-slate-200 flex-shrink-0" />
        <button
          type="button"
          onClick={() => { setParityFilter(parityFilter === "all" ? "even" : parityFilter === "even" ? "odd" : "all"); setCurrentIndex(0); }}
          className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors flex-shrink-0 ${
            parityFilter !== "all"
              ? "bg-brand-500 text-white border-brand-500"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          {parityFilter === "all" ? "Even/Odd" : parityFilter === "even" ? "Even only" : "Odd only"}
        </button>
        {gpsError && sortMode === "nearest" && (
          <span className="text-[10px] text-red-500 flex-shrink-0">GPS unavailable</span>
        )}
      </div>

      {/* Scrollable form area */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 pt-1.5 pb-4 max-w-lg mx-auto">

          {/* Person counter */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
            Person {currentIndex + 1} of {displayEntries.length}
          </p>

          {/* Household hero */}
          <div className="bg-gradient-to-r from-slate-50 to-white rounded-2xl border border-slate-200 px-4 py-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Household</p>
              {isMultiUnit && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 bg-sky-50 border border-sky-200 rounded-full px-2 h-4">
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Unit {buildingPosition} of {buildingEntries.length}
                </span>
              )}
            </div>
            <p className="text-[22px] font-extrabold text-slate-900 leading-tight tracking-tight">{addressLine}</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] text-slate-500">
                {cityLine}{cityLine ? " · " : ""}{coResidents.length + 1} on file
              </p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-[11px] font-medium hover:bg-slate-100 active:bg-slate-200 transition-colors"
                  >
                    <Navigation className="h-3 w-3" />
                    Navigate
                  </a>
                )}
              </div>
            </div>
            {(isLastEntry || walkMinutes !== null) && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isLastEntry ? "Last stop on route" : `~${walkMinutes} min walk to next`}
              </p>
            )}

            {/* Prior contact history */}
            {(current as LocalEntry & { priorContact?: { supportLevel: string | null; outcome: string | null; respondedAt: Date | string; canvasserName: string } | null }).priorContact && (() => {
              const pc = (current as LocalEntry & { priorContact: { supportLevel: string | null; outcome: string | null; respondedAt: Date | string; canvasserName: string } }).priorContact;
              const levelLabel = pc.supportLevel
                ? (SUPPORT_LEVEL_LABELS[pc.supportLevel as SupportLevel] ?? pc.supportLevel)
                : pc.outcome === "not_home" ? "Not home"
                : pc.outcome ?? "Contacted";
              const dateStr = formatVisitDate(pc.respondedAt);
              const isPositive = pc.supportLevel === "strong_yes" || pc.supportLevel === "soft_yes";
              const isNegative = pc.supportLevel === "strong_no" || pc.supportLevel === "soft_no";
              const badgeColor = isPositive
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : isNegative
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-slate-50 border-slate-200 text-slate-600";
              return (
                <div className={`mt-1.5 rounded-xl border px-3 py-1.5 ${badgeColor}`}>
                  <p className="text-xs font-medium">{levelLabel} · {dateStr}</p>
                  <p className="text-[10px] opacity-75">by {pc.canvasserName}</p>
                </div>
              );
            })()}

            {/* DNC warning */}
            {current.person.doNotContact && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
                <svg className="h-4 w-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <p className="text-xs font-semibold text-red-600">Do not contact — skip this door</p>
              </div>
            )}

            {/* Phone numbers */}
            {(current.person.phoneHome || current.person.phoneMobile) && (
              <div className="flex flex-col gap-1 mt-1.5">
                {current.person.phoneHome && (
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <a href={`tel:${current.person.phoneHome}`} className="text-base font-medium text-brand-600 flex-1">
                      {current.person.phoneHome}
                    </a>
                    <button
                      type="button"
                      aria-label="SMS home number"
                      onClick={() => {
                        const ok = window.confirm("This number is listed as a home phone and may not receive text messages. Send SMS anyway?");
                        if (ok) window.location.href = `sms:${current.person.phoneHome}`;
                      }}
                      className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {current.person.phoneMobile && current.person.phoneMobile !== current.person.phoneHome && (
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <a href={`tel:${current.person.phoneMobile}`} className="text-base font-medium text-brand-600 flex-1">
                      {current.person.phoneMobile}
                    </a>
                    <a href={`sms:${current.person.phoneMobile}`} aria-label="SMS mobile number" className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                      <MessageSquare className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Edit / Add links */}
            <div className="flex gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => { setShowEditConfirm((v) => !v); setShowAddResidentConfirm(false); }}
                className="text-[11px] text-brand-600 font-medium"
              >
                Edit record
              </button>
              <button
                type="button"
                onClick={() => { setShowAddResidentConfirm((v) => !v); setShowEditConfirm(false); }}
                className="text-[11px] text-brand-600 font-medium"
              >
                Add resident
              </button>
            </div>
          </div>

          {/* DNC: show skip button and hide form */}
          {current.person.doNotContact ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleSkip}
                disabled={isPending}
                className="w-full h-14 rounded-2xl border-2 border-slate-200 bg-white text-slate-700 font-bold text-base hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Skip →
              </button>
            </div>
          ) : (
            <>
              {/* Resident queue */}
              <div className="mb-1.5">
                {allResidents.map((r) => {
                  const isSelected = selectedPersonId === r.id;
                  const apptIso = appointmentsByPersonId[r.id];
                  const apptLabel = apptIso ? fmtApptBadge(apptIso) : null;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedPersonId(r.id)}
                      className={[
                        "w-full flex items-center gap-3 px-4 py-1.5 rounded-xl transition-colors text-left",
                        isSelected ? "bg-white border border-brand-200" : "hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <div className={[
                        "w-2 h-2 rounded-full flex-shrink-0",
                        isSelected ? "bg-brand-500" : "border border-slate-300",
                      ].join(" ")} />
                      <span className={[
                        "text-sm",
                        isSelected ? "font-semibold text-slate-900" : "text-slate-500",
                      ].join(" ")}>
                        {r.firstName} {r.lastName}
                      </span>
                      {apptLabel && (
                        <span className="ml-1 inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 flex-shrink-0">
                          {apptLabel}
                        </span>
                      )}
                      {isSelected && <span className="text-xs text-slate-400 ml-auto">recording…</span>}
                    </button>
                  );
                })}
              </div>

              {/* Outcome row: Spoke / Not home / Refused */}
              <div className="flex gap-1.5 mb-1.5">
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({
                    ...emptyDraft(),
                    notes: d.notes,
                    needsFollowUp: d.needsFollowUp,
                    otherOutcome: null,
                  }))}
                  className={[
                    "flex-1 h-11 rounded-xl border-2 text-sm font-semibold transition-all",
                    outcomeMode === "spoke"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Spoke
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNotHomeMenu((v) => !v); }}
                  className={[
                    "flex-1 h-11 rounded-xl border-2 text-sm font-semibold transition-all",
                    outcomeMode === "not_home"
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Not home
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({
                    ...emptyDraft(),
                    notes: d.notes,
                    needsFollowUp: d.needsFollowUp,
                    otherOutcome: "refused",
                  }))}
                  className={[
                    "flex-1 h-11 rounded-xl border-2 text-sm font-semibold transition-all",
                    outcomeMode === "refused"
                      ? "border-red-500 bg-red-500 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Refused
                </button>
              </div>

              {/* Not home sub-reasons dropdown */}
              {showNotHomeMenu && (
                <div className="relative mb-1.5">
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowNotHomeMenu(false)}
                    aria-hidden="true"
                  />
                  <div className="relative z-30 bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                    {NOT_HOME_OUTCOMES.map((o, idx) => (
                      <button
                        key={o.value}
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setDraft((d) => ({
                            ...emptyDraft(),
                            notes: d.notes,
                            needsFollowUp: d.needsFollowUp,
                            otherOutcome: o.value,
                          }));
                          setShowNotHomeMenu(false);
                        }}
                        className={[
                          "w-full px-4 py-3.5 text-sm font-medium text-slate-700 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50",
                          idx < NOT_HOME_OUTCOMES.length - 1 ? "border-b border-slate-100" : "",
                        ].join(" ")}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Not home selected sub-reason badge */}
              {outcomeMode === "not_home" && draft.otherOutcome && (
                <div className="mb-1.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-800">
                    {NOT_HOME_OUTCOMES.find((o) => o.value === draft.otherOutcome)?.label ?? draft.otherOutcome}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNotHomeMenu(true)}
                    className="text-xs text-amber-600 font-medium"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Support scale 1–5 (only when Spoke) */}
              {outcomeMode === "spoke" && (
                <>
                  <div className="flex gap-1 mb-1.5">
                    {SCALE_BUTTONS.map((s) => {
                      const isActive = draft.supportLevel === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          aria-pressed={isActive}
                          disabled={isPending}
                          onClick={() => {
                            setDraft((d) => ({
                              ...d,
                              supportLevel: isActive ? null : s.value,
                              outcomeDetail: s.value === "undecided" ? null : d.outcomeDetail,
                              otherOutcome: null,
                            }));
                          }}
                          className={[
                            "flex-1 h-16 sm:h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 border-2 transition-all disabled:opacity-50",
                            s.style,
                            isActive ? "ring-2 ring-slate-900 ring-offset-1" : "",
                          ].join(" ")}
                        >
                          <span className="text-xl font-bold">{s.numeral}</span>
                          <span className="text-[10px] font-medium">{s.caption}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Level 3 sub-options */}
                  {isUndecided && (
                    <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                      {UNDECIDED_SUB_OPTIONS.map((o) => {
                        const isActive = draft.outcomeDetail === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            disabled={isPending}
                            onClick={() => setDraft((d) => ({ ...d, outcomeDetail: isActive ? null : o.value }))}
                            className={[
                              "h-11 rounded-xl border text-xs font-medium transition-all disabled:opacity-50",
                              isActive
                                ? "border-amber-500 bg-amber-500 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100",
                            ].join(" ")}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Other Candidate (when support is 1 or 2) */}
                  {isNoLevel && (
                    <div className="mb-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            otherOutcome: d.otherOutcome === "other_candidate" ? null : "other_candidate",
                            competitorId: null,
                          }))
                        }
                        className={[
                          "w-full h-11 rounded-xl border font-medium text-sm transition-all",
                          draft.otherOutcome === "other_candidate"
                            ? "border-slate-600 bg-slate-700 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        Other Candidate
                      </button>
                      {draft.otherOutcome === "other_candidate" && competitors.length > 0 && (
                        <div className="mt-1.5 bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-widest">Which candidate?</p>
                          <div className="px-4 pb-3 flex flex-wrap gap-2">
                            {competitors.map((c) => {
                              const isSelected = draft.competitorId === c.id;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => setDraft((d) => ({ ...d, competitorId: isSelected ? null : c.id }))}
                                  className={[
                                    "h-9 px-4 rounded-full border text-sm font-medium transition-all",
                                    isSelected
                                      ? "border-slate-700 bg-slate-800 text-white"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                                  ].join(" ")}
                                >
                                  {c.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Toggles: Volunteer / Sign / Donate */}
                  <div className="flex gap-2 mb-1.5">
                    {[
                      { label: "🙋 Volunteer", checked: draft.volunteerInterest, toggle: () => setDraft((d) => ({ ...d, volunteerInterest: !d.volunteerInterest })) },
                      { label: "🪧 Sign",      checked: draft.signRequest,       toggle: () => setDraft((d) => ({ ...d, signRequest: !d.signRequest })) },
                      { label: "💰 Donate",    checked: draft.donorInterest,     toggle: () => setDraft((d) => ({ ...d, donorInterest: !d.donorInterest })) },
                    ].map(({ label, checked, toggle }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={toggle}
                        className={[
                          "h-11 px-3 rounded-xl border-2 text-xs font-semibold transition-all flex items-center justify-center flex-1",
                          checked
                            ? "border-brand-500 bg-brand-500 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Follow-up toggle */}
                  <div className="bg-slate-50 rounded-xl mb-1.5">
                    <CompactToggle
                      label="Needs follow-up"
                      checked={draft.needsFollowUp}
                      onChange={(v) => setDraft((d) => ({ ...d, needsFollowUp: v }))}
                    />
                  </div>
                </>
              )}

              {/* Notes — always visible */}
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Add a note…"
                rows={2}
                className="w-full px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none bg-slate-50 rounded-xl border border-slate-200 block mb-1.5"
              />

              {/* Survey required hint */}
              {activeSurvey && saveHint?.includes("survey") && (
                <p className="text-xs text-amber-600 text-center mb-1.5">
                  {saveHint}
                </p>
              )}
            </>
          )}
        </div>
      </main>

      {/* Edit/Add confirmations */}
      {showEditConfirm && (
        <div className="flex-none px-4 pb-2">
          <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
            <p className="text-sm font-semibold text-slate-900 mb-0.5">Edit this record?</p>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">Changes will be submitted for review and won&apos;t update the record until a manager approves.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowEditConfirm(false); setShowVoterChangeModal(true); }} className="flex-1 h-10 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition-colors">Yes, edit</button>
              <button type="button" onClick={() => setShowEditConfirm(false)} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-white active:bg-slate-100 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showAddResidentConfirm && (
        <div className="flex-none px-4 pb-2">
          <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
            <p className="text-sm font-semibold text-slate-900 mb-0.5">Add a new resident?</p>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">This will be submitted for review and won&apos;t appear in the voter list until a manager approves.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowAddResidentConfirm(false); setShowAddResidentModal(true); }} className="flex-1 h-10 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition-colors">Yes, add</button>
              <button type="button" onClick={() => setShowAddResidentConfirm(false)} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-white active:bg-slate-100 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer: Save & Continue + back */}
      {!current.person.doNotContact && !done && entries.length > 0 && (
        <footer className="flex-none bg-white border-t border-slate-100 px-4 pt-2 pb-4">
          {error && <p className="text-xs text-red-600 text-center mb-1.5">{error}</p>}
          {saveHint && !saveHint.includes("survey") && (
            <p className="text-xs text-slate-400 text-center mb-1.5">{saveHint}</p>
          )}
          <div className="flex gap-2 max-w-lg mx-auto">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={isPending || currentIndex === 0}
              aria-label="Previous person"
              className="h-14 w-14 flex-shrink-0 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className={[
                "flex-1 h-14 rounded-2xl font-bold text-base transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                saveFlash
                  ? "bg-emerald-500 text-white"
                  : canSave
                    ? "bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-md shadow-orange-200/50"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed",
              ].join(" ")}
            >
              {saveFlash ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Saved!
                </span>
              ) : isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </span>
              ) : (
                "Save & Continue →"
              )}
            </button>
          </div>
        </footer>
      )}

      {/* Modals */}
      {showVoterChangeModal && current && (
        <VoterChangeModal
          personId={current.person.id}
          campaignId={campaignId}
          currentRecord={{
            id: current.person.id,
            firstName: current.person.firstName,
            lastName: current.person.lastName,
            phoneHome: current.person.phoneHome,
            phoneMobile: current.person.phoneMobile ?? null,
            email: current.person.email ?? null,
            birthDate: current.person.birthDate ? new Date(current.person.birthDate).toISOString().slice(0, 10) : null,
          }}
          onClose={() => setShowVoterChangeModal(false)}
        />
      )}
      {showAddResidentModal && (
        <AddResidentModal
          campaignId={campaignId}
          campaignCity={campaignCity}
          onClose={() => setShowAddResidentModal(false)}
        />
      )}
    </div>
  );
}
