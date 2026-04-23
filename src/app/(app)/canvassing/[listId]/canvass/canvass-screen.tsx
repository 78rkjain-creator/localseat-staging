"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { saveCanvassResponse, addPersonAtDoor } from "./actions";
import type { CanvassingQueue } from "@/lib/canvassing";
import type { SupportLevel, CanvassOutcome } from "@/types";
import { enqueue } from "@/lib/offline-queue";
import { useOfflineSync } from "@/hooks/useOfflineSync";

// ── Types ──────────────────────────────────────────────────────────────────

type LocalEntry = CanvassingQueue["entries"][number] & {
  person: {
    phoneMobile: string | null;
    coResidents: { id: string; firstName: string; lastName: string }[];
  };
};

interface ResponseDraft {
  supportLevel: SupportLevel | null;
  otherOutcome: CanvassOutcome | null;
  signRequest: boolean;
  volunteerInterest: boolean;
  donorInterest: boolean;
  notes: string;
  needsFollowUp: boolean;
  competitorId: string | null;
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
    competitorId: null,
  };
}

// ── Support level config ───────────────────────────────────────────────────
// Kept for reference — no longer drives the UI directly.

const SUPPORT_LEVELS: {
  value: SupportLevel;
  label: string;
  style: string;
  activeStyle: string;
}[] = [
  {
    value: "strong_yes",
    label: "Strong Yes",
    style: "border-emerald-200 text-emerald-800 bg-white hover:bg-emerald-50 active:bg-emerald-100",
    activeStyle: "border-emerald-600 bg-emerald-500 text-white",
  },
  {
    value: "soft_yes",
    label: "Soft Yes",
    style: "border-teal-200 text-teal-800 bg-white hover:bg-teal-50 active:bg-teal-100",
    activeStyle: "border-teal-600 bg-teal-500 text-white",
  },
  {
    value: "undecided",
    label: "Undecided",
    style: "border-amber-200 text-amber-800 bg-white hover:bg-amber-50 active:bg-amber-100",
    activeStyle: "border-amber-600 bg-amber-500 text-white",
  },
  {
    value: "soft_no",
    label: "Soft No",
    style: "border-orange-200 text-orange-800 bg-white hover:bg-orange-50 active:bg-orange-100",
    activeStyle: "border-orange-600 bg-orange-500 text-white",
  },
  {
    value: "strong_no",
    label: "Strong No",
    style: "border-red-200 text-red-800 bg-white hover:bg-red-50 active:bg-red-100",
    activeStyle: "border-red-600 bg-red-500 text-white",
  },
];

// ── 1–5 scale button config ────────────────────────────────────────────────

const SCALE_BUTTONS: {
  value: SupportLevel;
  numeral: number;
  caption: string;
  style: string;
}[] = [
  { value: "strong_yes", numeral: 1, caption: "Yes+", style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { value: "soft_yes",   numeral: 2, caption: "Yes",  style: "border-emerald-100 bg-white text-emerald-600" },
  { value: "undecided",  numeral: 3, caption: "?",    style: "border-amber-200 bg-amber-50 text-amber-700" },
  { value: "soft_no",    numeral: 4, caption: "No",   style: "border-orange-200 bg-orange-50 text-orange-700" },
  { value: "strong_no",  numeral: 5, caption: "No−",  style: "border-red-200 bg-red-50 text-red-700" },
];

const OTHER_OUTCOMES: { value: CanvassOutcome; label: string }[] = [
  { value: "refused", label: "Refused" },
  { value: "moved", label: "Moved" },
  { value: "unavailable", label: "Unavailable" },
  { value: "deceased", label: "Deceased" },
  { value: "other_candidate", label: "Other candidate" },
];

// ── Main screen component ──────────────────────────────────────────────────

interface CanvassScreenProps {
  listId: string;
  listName: string;
  assignmentId: string;
  entries: CanvassingQueue["entries"];
  competitors: { id: string; name: string }[];
}

export function CanvassScreen({
  listId,
  listName,
  assignmentId,
  entries: initialEntries,
  competitors,
}: CanvassScreenProps) {
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

  // "Other outcome" section (Refused / Moved / Unavailable / Deceased + add person)
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Add person at door
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [addFirst, setAddFirst] = useState("");
  const [addLast, setAddLast] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAddingPerson, startAddTransition] = useTransition();

  // Outside ward warning — shown after addPersonAtDoor returns outsideWard: true
  const [outsideWardWarning, setOutsideWardWarning] = useState(false);
  useEffect(() => {
    if (!outsideWardWarning) return;
    const timer = setTimeout(() => setOutsideWardWarning(false), 4000);
    return () => clearTimeout(timer);
  }, [outsideWardWarning]);

  // Refs so async transitions always see current values
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const savedSetRef = useRef(savedSet);
  savedSetRef.current = savedSet;

  // ── Offline sync ──────────────────────────────────────────────────────────
  const { pendingCount, isSyncing, refresh: refreshSyncCount } =
    useOfflineSync(saveCanvassResponse);

  // Track SW registration failure so we can warn the canvasser.
  const [swFailure, setSwFailure] = useState(false);

  // Register the service worker once on mount (canvassing is the primary
  // offline-capable surface in LocalSeat).
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[CanvassScreen] SW registered:", reg.scope);
      })
      .catch((err) => {
        console.error("[CanvassScreen] SW registration failed:", err.message, err);
        setSwFailure(true);
      });
  }, []);

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
        setShowMoreOptions(false);
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
        setShowMoreOptions(false);
        return;
      }
    }
    setDone(true);
  }

  async function handleNotHome() {
    if (isPending) return;
    setError(null);
    const capturedIndex = currentIndex;
    const capturedPersonId = current.person.id;

    // ── Offline path ─────────────────────────────────────────────────────────
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        await enqueue({
          assignmentId,
          personId: capturedPersonId,
          outcome: "not_home",
          supportLevel: "not_home",
          wantsSign: false,
          isVolunteer: false,
          isDonorInterest: false,
          notes: "",
          competitorId: null,
          needsFollowUp: false,
        });
        await refreshSyncCount();
        markSavedAndAdvance(capturedPersonId, capturedIndex);
      } catch (err) {
        console.error("[CanvassScreen] IndexedDB enqueue failed:", err);
        setError("Failed to save offline. Please try again.");
      }
      return;
    }

    // ── Online path (unchanged) ───────────────────────────────────────────────
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
      if (result.error) { setError(result.error); return; }
      markSavedAndAdvance(capturedPersonId, capturedIndex);
    });
  }

  async function handleSave() {
    const { supportLevel, otherOutcome } = draft;
    if (!supportLevel && !otherOutcome) return;
    if (isPending) return;
    setError(null);

    const outcome: CanvassOutcome = otherOutcome
      ? otherOutcome
      : supportLevel === "not_home" ? "not_home" : "contacted";

    const capturedIndex = currentIndex;
    const capturedPersonId = current.person.id;

    const competitorId = otherOutcome === "other_candidate" ? draft.competitorId : null;

    // ── Offline path ─────────────────────────────────────────────────────────
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        await enqueue({
          assignmentId,
          personId: capturedPersonId,
          outcome,
          supportLevel: otherOutcome ? null : supportLevel,
          wantsSign: otherOutcome ? false : draft.signRequest,
          isVolunteer: otherOutcome ? false : draft.volunteerInterest,
          isDonorInterest: otherOutcome ? false : draft.donorInterest,
          notes: draft.notes,
          needsFollowUp: draft.needsFollowUp,
          competitorId,
        });
        await refreshSyncCount();
        markSavedAndAdvance(capturedPersonId, capturedIndex);
      } catch (err) {
        console.error("[CanvassScreen] IndexedDB enqueue failed:", err);
        setError("Failed to save offline. Please try again.");
      }
      return;
    }

    // ── Online path ───────────────────────────────────────────────────────────
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
        competitorId,
      });
      if (result.error) { setError(result.error); return; }
      markSavedAndAdvance(capturedPersonId, capturedIndex);
    });
  }

  function handleAddPerson() {
    const firstName = addFirst.trim();
    const lastName = addLast.trim();
    if (!firstName || !lastName) { setAddError("First and last name are required."); return; }
    setAddError(null);

    startAddTransition(async () => {
      const result = await addPersonAtDoor({
        listId,
        assignmentId,
        firstName,
        lastName,
        addressId: current?.person.address?.id ?? undefined,
      });
      if (result.error) { setAddError(result.error); return; }
      if (!result.person) return;

      if (result.outsideWard) setOutsideWardWarning(true);

      const newEntry: LocalEntry = {
        entryId: result.person.entryId,
        person: {
          id: result.person.id,
          firstName: result.person.firstName,
          lastName: result.person.lastName,
          phoneHome: null,
          phoneMobile: null,
          address: current?.person.address ?? null,
          coResidents: [],
        },
        lastResponse: null,
      };

      const next = [...entriesRef.current];
      next.splice(currentIndex + 1, 0, newEntry);
      setEntries(next);
      setShowAddPerson(false);
      setShowMoreOptions(false);
      setAddFirst("");
      setAddLast("");
    });
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const isContactedLevel =
    draft.supportLevel !== null && draft.supportLevel !== "not_home";
  // Levels 1–3 (strong_yes, soft_yes, undecided) — show interest chips instead of toggles
  const isLowSupport =
    draft.supportLevel !== null &&
    ["strong_yes", "soft_yes", "undecided"].includes(draft.supportLevel);
  const showDetails = isContactedLevel || !!draft.otherOutcome;
  const canSave = (!!draft.supportLevel || !!draft.otherOutcome) && !isPending;

  // ── Done screen ───────────────────────────────────────────────────────────

  if (done || entries.length === 0) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
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
              <span className="font-semibold text-slate-700">{totalCount}</span> people.
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
  // h-screen + flex-col: header / main / details / footer fill the viewport.
  // No element is position:fixed — everything is in normal document flow.
  // This guarantees zero scroll for the default view on any phone.

  return (
    <div className="h-screen [height:100dvh] bg-slate-50 flex flex-col overflow-hidden">

      {/* Fix 10: SW failure warning — shown when offline caching is unavailable */}
      {swFailure && (
        <div className="flex-none bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <svg className="h-4 w-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-amber-800">
            Offline caching unavailable — stay connected to save responses.
          </p>
        </div>
      )}

      {/* Outside ward warning — auto-dismisses after 4 seconds */}
      {outsideWardWarning && (
        <div className="flex-none bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <svg className="h-4 w-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-amber-800 flex-1">
            This address is outside your ward boundary. The record has been saved.
          </p>
          <button
            type="button"
            onClick={() => setOutsideWardWarning(false)}
            className="flex-shrink-0 text-amber-500 hover:text-amber-700 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Header ── compact, ~44px ── */}
      <header className="flex-none bg-white border-b border-slate-200 px-4 flex items-center gap-3 h-[44px]">
        <Link
          href="/canvassing"
          className="h-11 w-11 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors flex-shrink-0"
          aria-label="Exit canvassing"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Link>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-slate-500 truncate leading-none mb-1">{listName}</p>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-800 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <span className="text-sm font-semibold text-slate-600 flex-shrink-0 tabular-nums">
          {doneCount}/{totalCount}
        </span>
      </header>

      {/* ── Zone 2: Controls — flex-1, no scroll ── */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="px-4 pt-1.5 pb-0 max-w-lg mx-auto">

          {/* ── Household hero ── */}
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-2 mb-1.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Household</p>
            <p className="text-[20px] font-extrabold text-slate-900 leading-tight">{addressLine}</p>
            <p className="text-[12px] text-slate-500">
              {cityLine}{cityLine ? " · " : ""}{coResidents.length + 1} on file
            </p>
            {current.lastResponse && (
              <span className="inline-block mt-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 text-[11px] font-medium">
                Previously recorded
              </span>
            )}
          </div>

          {/* ── Resident queue ── */}
          <div className="mb-1.5">
            <div className="flex items-center gap-3 px-4 py-1.5 bg-white rounded-xl border border-brand-200">
              <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-slate-900">
                {current.person.firstName} {current.person.lastName}
              </span>
              <span className="text-xs text-slate-400 ml-auto">recording…</span>
            </div>
            {coResidents.map((r: { id: string; firstName: string; lastName: string }) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-1.5">
                <div className="w-2 h-2 rounded-full border border-slate-300 flex-shrink-0" />
                <span className="text-sm text-slate-500">{r.firstName} {r.lastName}</span>
                <span className="text-xs text-slate-300 ml-auto">next</span>
              </div>
            ))}
          </div>

          {/* ── Support scale 1–5 ── */}
          <div className="flex gap-1 mb-1.5">
            {SCALE_BUTTONS.map((s) => {
              const isActive = draft.supportLevel === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() =>
                    setDraft((d) => ({
                      ...emptyDraft(),
                      needsFollowUp: d.needsFollowUp,
                      notes: d.notes,
                      supportLevel: isActive ? null : s.value,
                    }))
                  }
                  className={[
                    "flex-1 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 border-2 transition-all",
                    s.style,
                    isActive ? "ring-2 ring-slate-900 ring-offset-1" : "",
                  ].join(" ")}
                >
                  <span className="text-lg font-bold">{s.numeral}</span>
                  <span className="text-[10px] font-medium">{s.caption}</span>
                </button>
              );
            })}
          </div>

          {/* ── Interest chips — visible when support is 1–3 ── */}
          {isLowSupport && (
            <div className="flex gap-2 mb-1.5">
              {[
                { label: "Sign",      checked: draft.signRequest,       toggle: () => setDraft((d) => ({ ...d, signRequest: !d.signRequest })) },
                { label: "Volunteer", checked: draft.volunteerInterest, toggle: () => setDraft((d) => ({ ...d, volunteerInterest: !d.volunteerInterest })) },
                { label: "Donate",    checked: draft.donorInterest,     toggle: () => setDraft((d) => ({ ...d, donorInterest: !d.donorInterest })) },
              ].map(({ label, checked, toggle }) => (
                <button
                  key={label}
                  type="button"
                  onClick={toggle}
                  className={[
                    "h-10 px-4 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-1.5",
                    checked
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Other outcome — collapsed by default */}
          <button
            type="button"
            onClick={() => setShowMoreOptions((v) => !v)}
            className="w-full h-9 flex items-center justify-between px-0.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="text-xs font-medium">Other outcome</span>
            <svg
              className={["h-3.5 w-3.5 transition-transform", showMoreOptions ? "rotate-180" : ""].join(" ")}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Expanded: refused / moved / unavailable / deceased + add person */}
          {showMoreOptions && (
            <div className="space-y-2 pt-1 pb-1">
              <div className="grid grid-cols-2 gap-1.5">
                {OTHER_OUTCOMES.map((o) => {
                  const isActive = draft.otherOutcome === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...emptyDraft(),
                          needsFollowUp: d.needsFollowUp,
                          notes: d.notes,
                          otherOutcome: isActive ? null : o.value,
                        }))
                      }
                      className={[
                        "h-11 rounded-xl border font-medium text-sm transition-all",
                        isActive
                          ? "border-slate-600 bg-slate-700 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>

              {/* Competitor picker — shown when "Other candidate" is selected and competitors exist */}
              {draft.otherOutcome === "other_candidate" && competitors.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    Which candidate?
                  </p>
                  <div className="px-4 pb-3 flex flex-wrap gap-2">
                    {competitors.map((c) => {
                      const isSelected = draft.competitorId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({ ...d, competitorId: isSelected ? null : c.id }))
                          }
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

              {/* Add person at door */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setShowAddPerson((v) => !v); setAddError(null); }}
                  className="w-full h-11 flex items-center gap-3 px-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <svg className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm font-medium text-slate-600">Add person at door</span>
                </button>
                {showAddPerson && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="First name"
                        value={addFirst}
                        onChange={(e) => setAddFirst(e.target.value)}
                        className="h-11 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        placeholder="Last name"
                        value={addLast}
                        onChange={(e) => setAddLast(e.target.value)}
                        className="h-11 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      />
                    </div>
                    {addError && <p className="text-xs text-red-600">{addError}</p>}
                    <button
                      type="button"
                      onClick={handleAddPerson}
                      disabled={isAddingPerson || !addFirst.trim() || !addLast.trim()}
                      className="w-full h-11 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 active:bg-slate-900 transition-colors disabled:opacity-40"
                    >
                      {isAddingPerson ? "Adding…" : "Add to list"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Details panel — toggles + notes ── */}
          {showDetails && (
            <div className="bg-white border-t-2 border-slate-200 divide-y divide-slate-100 mt-1.5">
              {isContactedLevel && !isLowSupport && (
                <>
                  <CompactToggle
                    label="Yard sign"
                    checked={draft.signRequest}
                    onChange={(v) => setDraft((d) => ({ ...d, signRequest: v }))}
                  />
                  <CompactToggle
                    label="Volunteer interest"
                    checked={draft.volunteerInterest}
                    onChange={(v) => setDraft((d) => ({ ...d, volunteerInterest: v }))}
                  />
                  <CompactToggle
                    label="Donor interest"
                    checked={draft.donorInterest}
                    onChange={(v) => setDraft((d) => ({ ...d, donorInterest: v }))}
                  />
                </>
              )}
              <CompactToggle
                label="Needs follow-up"
                checked={draft.needsFollowUp}
                onChange={(v) => setDraft((d) => ({ ...d, needsFollowUp: v }))}
              />
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Note (optional)…"
                rows={2}
                className="w-full px-4 py-2 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none bg-transparent block"
              />
            </div>
          )}

        </div>
      </main>

      {/* ── Offline sync pill — sits above footer ── */}
      <OfflinePill pendingCount={pendingCount} isSyncing={isSyncing} />

      {/* ── Zone 3: Actions — pinned bottom, clears mobile nav ── */}
      <footer className="flex-none bg-white border-t border-slate-100 px-4 pt-2 pb-16">
        {error && (
          <p className="text-xs text-red-600 text-center mb-1.5">{error}</p>
        )}
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isPending}
            className="h-12 px-5 rounded-2xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={[
              "flex-1 h-12 rounded-2xl font-bold text-base transition-all",
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
              "Save and next →"
            )}
          </button>
        </div>
      </footer>

    </div>
  );
}

// ── Offline sync pill ──────────────────────────────────────────────────────

function OfflinePill({ pendingCount, isSyncing }: { pendingCount: number; isSyncing: boolean }) {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  if (!isOnline) {
    return (
      <div className="fixed bottom-36 left-4 z-10 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full">
        Offline · {pendingCount} queued
      </div>
    );
  }
  if (isSyncing) {
    return (
      <div className="fixed bottom-36 left-4 z-10 bg-white border border-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded-full">
        Syncing…
      </div>
    );
  }
  return (
    <div className="fixed bottom-36 left-4 z-10 bg-white border border-slate-200 text-slate-500 text-xs px-3 py-1.5 rounded-full">
      {pendingCount} to sync
    </div>
  );
}

// ── Compact toggle — no description, 44px touch target ─────────────────────

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
