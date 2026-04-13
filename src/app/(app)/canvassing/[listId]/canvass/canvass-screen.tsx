"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { saveCanvassResponse } from "./actions";
import type { CanvassingQueue } from "@/lib/canvassing";
import type { CanvassOutcome, SupportLevel } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface ResponseDraft {
  outcome: CanvassOutcome | null;
  supportLevel: SupportLevel | null;
  signRequest: boolean;
  volunteerInterest: boolean;
  donorInterest: boolean;
  notes: string;
  needsFollowUp: boolean;
}

function emptyDraft(): ResponseDraft {
  return {
    outcome: null,
    supportLevel: null,
    signRequest: false,
    volunteerInterest: false,
    donorInterest: false,
    notes: "",
    needsFollowUp: false,
  };
}

// ── Support level config ───────────────────────────────────────────────────

const SUPPORT_LEVELS: { value: SupportLevel; label: string; short: string; style: string; activeStyle: string }[] = [
  {
    value: "strong_support",
    label: "Strong Support",
    short: "Strong ✓",
    style: "border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50",
    activeStyle: "border-emerald-500 bg-emerald-500 text-white",
  },
  {
    value: "lean_support",
    label: "Lean Support",
    short: "Lean ✓",
    style: "border-teal-200 text-teal-700 bg-white hover:bg-teal-50",
    activeStyle: "border-teal-500 bg-teal-500 text-white",
  },
  {
    value: "undecided",
    label: "Undecided",
    short: "Undecided",
    style: "border-amber-200 text-amber-700 bg-white hover:bg-amber-50",
    activeStyle: "border-amber-500 bg-amber-500 text-white",
  },
  {
    value: "lean_against",
    label: "Lean Against",
    short: "Lean ✗",
    style: "border-orange-200 text-orange-700 bg-white hover:bg-orange-50",
    activeStyle: "border-orange-500 bg-orange-500 text-white",
  },
  {
    value: "strong_against",
    label: "Strong Against",
    short: "Strong ✗",
    style: "border-red-200 text-red-700 bg-white hover:bg-red-50",
    activeStyle: "border-red-500 bg-red-500 text-white",
  },
  {
    value: "unknown",
    label: "Unknown",
    short: "Unknown",
    style: "border-slate-200 text-slate-500 bg-white hover:bg-slate-50",
    activeStyle: "border-slate-500 bg-slate-500 text-white",
  },
];

// ── Outcome config ─────────────────────────────────────────────────────────

const OUTCOMES: { value: CanvassOutcome; label: string; style: string; activeStyle: string }[] = [
  {
    value: "contacted",
    label: "Contacted",
    style: "border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50",
    activeStyle: "border-emerald-500 bg-emerald-500 text-white",
  },
  {
    value: "not_home",
    label: "Not Home",
    style: "border-slate-200 text-slate-600 bg-white hover:bg-slate-50",
    activeStyle: "border-slate-500 bg-slate-500 text-white",
  },
  {
    value: "refused",
    label: "Refused",
    style: "border-red-200 text-red-600 bg-white hover:bg-red-50",
    activeStyle: "border-red-500 bg-red-500 text-white",
  },
  {
    value: "moved",
    label: "Moved",
    style: "border-purple-200 text-purple-600 bg-white hover:bg-purple-50",
    activeStyle: "border-purple-500 bg-purple-500 text-white",
  },
  {
    value: "unavailable",
    label: "Unavailable",
    style: "border-amber-200 text-amber-700 bg-white hover:bg-amber-50",
    activeStyle: "border-amber-500 bg-amber-500 text-white",
  },
  {
    value: "deceased",
    label: "Deceased",
    style: "border-slate-200 text-slate-500 bg-white hover:bg-slate-50",
    activeStyle: "border-slate-400 bg-slate-200 text-slate-600",
  },
];

// ── Main screen component ──────────────────────────────────────────────────

interface CanvassScreenProps {
  listId: string;
  listName: string;
  assignmentId: string;
  entries: CanvassingQueue["entries"];
}

export function CanvassScreen({
  listId,
  listName,
  assignmentId,
  entries,
}: CanvassScreenProps) {
  // Start at the first entry that hasn't been responded to yet
  const firstPending = entries.findIndex((e) => !e.lastResponse);
  const [currentIndex, setCurrentIndex] = useState(
    firstPending >= 0 ? firstPending : 0
  );
  const [draft, setDraft] = useState<ResponseDraft>(emptyDraft);
  // Track which person IDs were saved in this session
  const [savedThisSession, setSavedThisSession] = useState<Set<string>>(
    new Set(entries.filter((e) => e.lastResponse).map((e) => e.person.id))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(firstPending < 0 && entries.length > 0);

  const current = entries[currentIndex];

  const advanceToNext = useCallback(
    (fromIndex: number) => {
      // Find the next entry that hasn't been saved in this session
      for (let i = fromIndex + 1; i < entries.length; i++) {
        if (!savedThisSession.has(entries[i].person.id)) {
          setCurrentIndex(i);
          setDraft(emptyDraft());
          setError(null);
          return;
        }
      }
      // No more unsaved — done
      setDone(true);
    },
    [entries, savedThisSession]
  );

  function handleSkip() {
    advanceToNext(currentIndex);
  }

  function handleSave() {
    if (!draft.outcome) return;
    setError(null);

    startTransition(async () => {
      const result = await saveCanvassResponse({
        assignmentId,
        personId: current.person.id,
        outcome: draft.outcome!,
        supportLevel: draft.supportLevel,
        signRequest: draft.signRequest,
        volunteerInterest: draft.volunteerInterest,
        donorInterest: draft.donorInterest,
        notes: draft.notes,
        needsFollowUp: draft.needsFollowUp,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      const newSaved = new Set(savedThisSession);
      newSaved.add(current.person.id);
      setSavedThisSession(newSaved);
      advanceToNext(currentIndex);
    });
  }

  const totalCount = entries.length;
  const doneCount = savedThisSession.size;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // ── Done screen ────────────────────────────────────────────────────────
  if (done || (entries.length === 0)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        {entries.length === 0 ? (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-2">No people on this list</h1>
            <p className="text-slate-500 text-sm mb-8">The list doesn&apos;t have any entries yet.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-2">All done!</h1>
            <p className="text-slate-500 text-sm mb-2">
              You recorded responses for <span className="font-semibold text-slate-700">{doneCount}</span> of{" "}
              <span className="font-semibold text-slate-700">{totalCount}</span> people on this list.
            </p>
            <p className="text-slate-400 text-xs mb-8">Great work today.</p>
          </>
        )}
        <Link
          href="/canvassing"
          className="inline-flex items-center gap-2 h-12 px-6 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-2xl text-sm transition-colors"
        >
          Back to my lists
        </Link>
      </div>
    );
  }

  const addr = current.person.address;
  const addressLine = addr
    ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
    : "Unknown address";
  const cityLine = addr ? `${addr.city}, ${addr.province}` : "";

  const isContacted = draft.outcome === "contacted";
  const canSave = draft.outcome !== null && !isPending;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Link
          href="/canvassing"
          className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Exit canvassing"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Link>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 truncate">{listName}</p>
          {/* Progress bar */}
          <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <span className="text-sm font-medium text-slate-500 flex-shrink-0 tabular-nums">
          {doneCount}/{totalCount}
        </span>
      </header>

      {/* ── Main scrollable content ── */}
      <main className="flex-1 overflow-y-auto pb-32">
        <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">

          {/* Address card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-5 py-4 mb-4">
            <p className="text-xl font-bold text-slate-900">{addressLine}</p>
            {cityLine && <p className="text-sm text-slate-500 mt-0.5">{cityLine}</p>}
          </div>

          {/* Person card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-5 py-4 mb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {current.person.firstName} {current.person.lastName}
                </p>
                {current.person.phone && (
                  <a
                    href={`tel:${current.person.phone}`}
                    className="inline-flex items-center gap-1.5 text-sm text-brand-600 mt-1"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {current.person.phone}
                  </a>
                )}
              </div>
              {current.lastResponse && (
                <span className="flex-shrink-0 text-xs bg-slate-100 text-slate-500 rounded-full px-2.5 py-1">
                  Previously recorded
                </span>
              )}
            </div>
          </div>

          {/* Outcome selector */}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 px-1">
            How did it go?
          </p>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {OUTCOMES.map((o) => {
              const isActive = draft.outcome === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      outcome: isActive ? null : o.value,
                      // Reset support details if deselecting contacted
                      supportLevel: isActive || o.value !== "contacted" ? null : d.supportLevel,
                    }))
                  }
                  className={[
                    "h-12 rounded-2xl border font-medium text-sm transition-all",
                    isActive ? o.activeStyle : o.style,
                  ].join(" ")}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          {/* Contacted details */}
          {isContacted && (
            <div className="flex flex-col gap-5">
              {/* Support level */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 px-1">
                  Support level
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SUPPORT_LEVELS.map((s) => {
                    const isActive = draft.supportLevel === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            supportLevel: isActive ? null : s.value,
                          }))
                        }
                        className={[
                          "h-11 rounded-2xl border font-medium text-xs transition-all",
                          isActive ? s.activeStyle : s.style,
                        ].join(" ")}
                        title={s.label}
                      >
                        {s.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                <ToggleRow
                  label="Sign request"
                  description="They want a lawn sign"
                  checked={draft.signRequest}
                  onChange={(v) => setDraft((d) => ({ ...d, signRequest: v }))}
                />
                <ToggleRow
                  label="Volunteer interest"
                  description="Open to helping the campaign"
                  checked={draft.volunteerInterest}
                  onChange={(v) => setDraft((d) => ({ ...d, volunteerInterest: v }))}
                />
                <ToggleRow
                  label="Donor interest"
                  description="Potential donor"
                  checked={draft.donorInterest}
                  onChange={(v) => setDraft((d) => ({ ...d, donorInterest: v }))}
                />
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
                  Notes
                </p>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Optional note about this conversation…"
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              {/* Follow-up */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
                <ToggleRow
                  label="Needs follow-up"
                  description="Add to follow-up queue"
                  checked={draft.needsFollowUp}
                  onChange={(v) => setDraft((d) => ({ ...d, needsFollowUp: v }))}
                />
              </div>
            </div>
          )}

          {/* Non-contacted follow-up */}
          {draft.outcome && !isContacted && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
              <ToggleRow
                label="Needs follow-up"
                description="Add to follow-up queue"
                checked={draft.needsFollowUp}
                onChange={(v) => setDraft((d) => ({ ...d, needsFollowUp: v }))}
              />
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
          )}
        </div>
      </main>

      {/* ── Sticky footer ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-100 px-4 py-4 safe-area-bottom">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isPending}
            className="h-14 px-5 rounded-2xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={[
              "flex-1 h-14 rounded-2xl font-semibold text-base transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
              canSave
                ? "bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-sm"
                : "bg-slate-100 text-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </span>
            ) : (
              "Save & Next →"
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}

// ── Toggle row sub-component ───────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors rounded-3xl"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      {/* Toggle pill */}
      <div
        className={[
          "relative h-7 w-12 rounded-full transition-colors flex-shrink-0",
          checked ? "bg-brand-500" : "bg-slate-200",
        ].join(" ")}
      >
        <div
          className={[
            "absolute top-1 h-5 w-5 bg-white rounded-full shadow-sm transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </div>
    </button>
  );
}
