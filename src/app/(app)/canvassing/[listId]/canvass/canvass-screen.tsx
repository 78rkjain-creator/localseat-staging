"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { saveCanvassResponse, addPersonAtDoor } from "./actions";
import type { CanvassingQueue } from "@/lib/canvassing";
import type { SupportLevel, CanvassOutcome } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

type LocalEntry = CanvassingQueue["entries"][number] & {
  person: { coResidents: { id: string; firstName: string; lastName: string }[] };
};

interface ResponseDraft {
  supportLevel: SupportLevel | null;    // null = nothing selected
  otherOutcome: CanvassOutcome | null;  // refused / moved / unavailable / deceased
  signRequest: boolean;
  volunteerInterest: boolean;
  donorInterest: boolean;
  notes: string;
  needsFollowUp: boolean;
}

function emptyDraft(): ResponseDraft {
  return {
    supportLevel: null,
    otherOutcome: null,
    signRequest: false,
    volunteerInterest: false,
    donorInterest: false,
    notes: "",
    needsFollowUp: false,
  };
}

// ── Support level config (5 primary options — not_home handled separately) ─

const SUPPORT_LEVELS: {
  value: SupportLevel;
  label: string;
  style: string;
  activeStyle: string;
}[] = [
  {
    value: "strong_yes",
    label: "Strong Yes",
    style: "border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50",
    activeStyle: "border-emerald-500 bg-emerald-500 text-white",
  },
  {
    value: "soft_yes",
    label: "Soft Yes",
    style: "border-teal-200 text-teal-700 bg-white hover:bg-teal-50",
    activeStyle: "border-teal-500 bg-teal-500 text-white",
  },
  {
    value: "undecided",
    label: "Undecided",
    style: "border-amber-200 text-amber-700 bg-white hover:bg-amber-50",
    activeStyle: "border-amber-500 bg-amber-500 text-white",
  },
  {
    value: "soft_no",
    label: "Soft No",
    style: "border-orange-200 text-orange-700 bg-white hover:bg-orange-50",
    activeStyle: "border-orange-500 bg-orange-500 text-white",
  },
  {
    value: "strong_no",
    label: "Strong No",
    style: "border-red-200 text-red-700 bg-white hover:bg-red-50",
    activeStyle: "border-red-500 bg-red-500 text-white",
  },
];

const OTHER_OUTCOMES: { value: CanvassOutcome; label: string }[] = [
  { value: "refused", label: "Refused" },
  { value: "moved", label: "Moved" },
  { value: "unavailable", label: "Unavailable" },
  { value: "deceased", label: "Deceased" },
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
  entries: initialEntries,
}: CanvassScreenProps) {
  // Local entries allow adding new people at door without a page reload
  const [entries, setEntries] = useState<LocalEntry[]>(
    () => initialEntries as LocalEntry[]
  );

  const firstPending = entries.findIndex((e) => !e.lastResponse);
  const [currentIndex, setCurrentIndex] = useState(
    firstPending >= 0 ? firstPending : 0
  );
  const [draft, setDraft] = useState<ResponseDraft>(emptyDraft);
  const [savedSet, setSavedSet] = useState<Set<string>>(
    () => new Set(entries.filter((e) => e.lastResponse).map((e) => e.person.id))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(firstPending < 0 && entries.length > 0);

  // Add person at door state
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [addFirst, setAddFirst] = useState("");
  const [addLast, setAddLast] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAddingPerson, startAddTransition] = useTransition();

  // Refs so async callbacks always see the latest values
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const savedSetRef = useRef(savedSet);
  savedSetRef.current = savedSet;

  const current = entries[currentIndex];
  const totalCount = entries.length;
  const doneCount = savedSet.size;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function markSavedAndAdvance(personId: string, fromIndex: number) {
    const newSaved = new Set(savedSetRef.current);
    newSaved.add(personId);
    setSavedSet(newSaved);

    const currentEntries = entriesRef.current;
    for (let i = fromIndex + 1; i < currentEntries.length; i++) {
      if (!newSaved.has(currentEntries[i].person.id)) {
        setCurrentIndex(i);
        setDraft(emptyDraft());
        setError(null);
        return;
      }
    }
    setDone(true);
  }

  function handleSkip() {
    setError(null);
    const currentEntries = entriesRef.current;
    for (let i = currentIndex + 1; i < currentEntries.length; i++) {
      if (!savedSetRef.current.has(currentEntries[i].person.id)) {
        setCurrentIndex(i);
        setDraft(emptyDraft());
        return;
      }
    }
    setDone(true);
  }

  // One-tap Not Home — saves immediately, no Save & Next needed
  function handleNotHome() {
    if (isPending) return;
    setError(null);
    const capturedIndex = currentIndex;
    const capturedPersonId = current.person.id;

    startTransition(async () => {
      const result = await saveCanvassResponse({
        assignmentId,
        personId: capturedPersonId,
        outcome: "not_home",
        supportLevel: "not_home",
        signRequest: false,
        volunteerInterest: false,
        donorInterest: false,
        notes: "",
        needsFollowUp: false,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      markSavedAndAdvance(capturedPersonId, capturedIndex);
    });
  }

  function handleSave() {
    const { supportLevel, otherOutcome } = draft;
    if (!supportLevel && !otherOutcome) return;
    if (isPending) return;
    setError(null);

    const outcome: CanvassOutcome = otherOutcome
      ? otherOutcome
      : (supportLevel === "not_home" ? "not_home" : "contacted");

    const capturedIndex = currentIndex;
    const capturedPersonId = current.person.id;

    startTransition(async () => {
      const result = await saveCanvassResponse({
        assignmentId,
        personId: capturedPersonId,
        outcome,
        supportLevel: otherOutcome ? null : supportLevel,
        signRequest: otherOutcome ? false : draft.signRequest,
        volunteerInterest: otherOutcome ? false : draft.volunteerInterest,
        donorInterest: otherOutcome ? false : draft.donorInterest,
        notes: draft.notes,
        needsFollowUp: draft.needsFollowUp,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      markSavedAndAdvance(capturedPersonId, capturedIndex);
    });
  }

  function handleAddPerson() {
    const firstName = addFirst.trim();
    const lastName = addLast.trim();
    if (!firstName || !lastName) {
      setAddError("First and last name are required.");
      return;
    }
    setAddError(null);

    startAddTransition(async () => {
      const result = await addPersonAtDoor({
        listId,
        assignmentId,
        firstName,
        lastName,
      });
      if (result.error) {
        setAddError(result.error);
        return;
      }
      if (!result.person) return;

      // Build a minimal entry for the new person, inheriting the current address
      const newEntry: LocalEntry = {
        entryId: result.person.entryId,
        person: {
          id: result.person.id,
          firstName: result.person.firstName,
          lastName: result.person.lastName,
          phone: null,
          address: current?.person.address ?? null,
          coResidents: [],
        },
        lastResponse: null,
      };

      const next = [...entriesRef.current];
      next.splice(currentIndex + 1, 0, newEntry);
      setEntries(next);
      setShowAddPerson(false);
      setAddFirst("");
      setAddLast("");
    });
  }

  // ── Derived UI state ──────────────────────────────────────────────────────

  const isContactedLevel =
    draft.supportLevel !== null && draft.supportLevel !== "not_home";
  const hasSelection = draft.supportLevel !== null || draft.otherOutcome !== null;
  const canSave = hasSelection && !isPending;

  // ── Done screen ───────────────────────────────────────────────────────────

  if (done || entries.length === 0) {
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
              You recorded responses for{" "}
              <span className="font-semibold text-slate-700">{doneCount}</span> of{" "}
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

  const coResidents = current.person.coResidents ?? [];

  // ── Active canvassing screen ──────────────────────────────────────────────

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
      <main className="flex-1 overflow-y-auto pb-36">
        <div className="px-4 pt-5 pb-4 max-w-lg mx-auto space-y-4">

          {/* Address card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-5 py-4">
            <p className="text-xl font-bold text-slate-900 leading-tight">{addressLine}</p>
            {cityLine && <p className="text-sm text-slate-500 mt-0.5">{cityLine}</p>}
            {coResidents.length > 0 && (
              <p className="text-xs text-slate-400 mt-2">
                Also here:{" "}
                {coResidents.map((r) => `${r.firstName} ${r.lastName}`).join(", ")}
              </p>
            )}
          </div>

          {/* Current person */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-5 py-4">
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

          {/* ── Support level selector ── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 px-1">
              Support level
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {SUPPORT_LEVELS.map((s) => {
                const isActive = draft.supportLevel === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...emptyDraft(),
                        supportLevel: isActive ? null : s.value,
                      }))
                    }
                    className={[
                      "h-14 rounded-2xl border-2 font-semibold text-sm transition-all",
                      isActive ? s.activeStyle : s.style,
                    ].join(" ")}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* Not Home — one tap */}
            <button
              type="button"
              onClick={handleNotHome}
              disabled={isPending}
              className={[
                "w-full h-14 rounded-2xl border-2 font-semibold text-sm transition-all",
                isPending
                  ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                  : "border-slate-200 text-slate-500 bg-white hover:bg-slate-50 active:bg-slate-100",
              ].join(" ")}
            >
              {isPending ? "Saving…" : "Not Home"}
            </button>
          </div>

          {/* ── Other outcomes (refused / moved / unavailable / deceased) ── */}
          <div className="flex flex-wrap gap-2">
            {OTHER_OUTCOMES.map((o) => {
              const isActive = draft.otherOutcome === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...emptyDraft(),
                      otherOutcome: isActive ? null : o.value,
                    }))
                  }
                  className={[
                    "h-9 px-4 rounded-full border text-xs font-medium transition-all",
                    isActive
                      ? "border-slate-500 bg-slate-500 text-white"
                      : "border-slate-200 text-slate-500 bg-white hover:bg-slate-50",
                  ].join(" ")}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          {/* ── Contacts-only details (shown when a real support level is selected) ── */}
          {isContactedLevel && (
            <div className="flex flex-col gap-4">
              {/* Sign / volunteer / donor toggles */}
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
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Note from this conversation (optional)…"
                rows={3}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          )}

          {/* ── Follow-up (visible whenever something is selected) ── */}
          {hasSelection && !draft.otherOutcome && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
              <ToggleRow
                label="Needs follow-up"
                description="Add to follow-up queue"
                checked={draft.needsFollowUp}
                onChange={(v) => setDraft((d) => ({ ...d, needsFollowUp: v }))}
              />
            </div>
          )}

          {/* ── Error message ── */}
          {error && (
            <p className="text-sm text-red-600 text-center px-2">{error}</p>
          )}

          {/* ── Add person at door ── */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setShowAddPerson((v) => !v);
                setAddError(null);
              }}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-600">Add person at door</span>
              <svg
                className={["h-4 w-4 text-slate-400 ml-auto transition-transform", showAddPerson ? "rotate-180" : ""].join(" ")}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showAddPerson && (
              <div className="px-5 pb-5 pt-1 border-t border-slate-50 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="First name"
                    value={addFirst}
                    onChange={(e) => setAddFirst(e.target.value)}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    value={addLast}
                    onChange={(e) => setAddLast(e.target.value)}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
                {addError && (
                  <p className="text-xs text-red-600">{addError}</p>
                )}
                <button
                  type="button"
                  onClick={handleAddPerson}
                  disabled={isAddingPerson || !addFirst.trim() || !addLast.trim()}
                  className="w-full h-11 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 active:bg-slate-900 transition-colors disabled:opacity-40"
                >
                  {isAddingPerson ? "Adding…" : "Add to list"}
                </button>
                <p className="text-xs text-slate-400 text-center">
                  Will be tagged as a field entry and added to this walk list.
                </p>
              </div>
            )}
          </div>

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
