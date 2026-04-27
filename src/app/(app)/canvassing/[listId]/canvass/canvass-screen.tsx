"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { Navigation, Home, Smartphone, MessageSquare } from "lucide-react";
import { saveCanvassResponse } from "./actions";
import type { CanvassingQueue } from "@/lib/canvassing";
import type { SupportLevel, CanvassOutcome } from "@/types";
import { VoterChangeModal } from "@/components/voter-change-modal";
import { AddResidentModal } from "@/components/add-resident-modal";
import { enqueue } from "@/lib/offline-queue";
import type { QueuedResponse } from "@/lib/offline-queue";

function formatVisitDate(iso: string | Date): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) {
    return `today at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
import { useOfflineSync } from "@/hooks/useOfflineSync";

function fmtApptBadge(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ── Types ──────────────────────────────────────────────────────────────────

type LocalEntry = CanvassingQueue["entries"][number] & {
  person: {
    phoneMobile: string | null;
    email: string | null;
    birthDate: Date | null;
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
  scheduleAppointment: boolean;
  appointmentDate: string;
  appointmentTime: string;
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
    scheduleAppointment: false,
    appointmentDate: "",
    appointmentTime: "",
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function draftFromLastResponse(
  response: { supportLevel: string | null } | null
): ResponseDraft {
  if (!response) return emptyDraft();
  return {
    ...emptyDraft(),
    supportLevel: (response.supportLevel as SupportLevel | null) ?? null,
  };
}

// ── Support level config ───────────────────────────────────────────────────
// Kept for reference — not used to drive UI directly.

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

// Level 3 quick-save outcomes
const LEVEL_3_OUTCOMES: { value: CanvassOutcome; label: string }[] = [
  { value: "refused",     label: "Refused" },
  { value: "moved",       label: "Moved" },
  { value: "unavailable", label: "Unavailable" },
  { value: "deceased",    label: "Deceased" },
];

// ── Main screen component ──────────────────────────────────────────────────

interface CanvassScreenProps {
  listId: string;
  listName: string;
  assignmentId: string;
  campaignId: string;
  campaignCity?: string;
  canvassScript?: string | null;
  entries: CanvassingQueue["entries"];
  competitors: { id: string; name: string }[];
  /** personId → ISO datetime string of upcoming appointment */
  appointmentsByPersonId?: Record<string, string>;
}

export function CanvassScreen({
  listId,
  listName,
  assignmentId,
  campaignId,
  campaignCity = "",
  canvassScript,
  entries: initialEntries,
  competitors,
  appointmentsByPersonId = {},
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

  // Who the canvasser is speaking with at this door
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    () => entries[firstPending >= 0 ? firstPending : 0]?.person.id ?? ""
  );

  // Canvassing script panel
  const [showScript, setShowScript] = useState(false);

  const [showVoterChangeModal, setShowVoterChangeModal] = useState(false);
  const [showAddResidentModal, setShowAddResidentModal] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showAddResidentConfirm, setShowAddResidentConfirm] = useState(false);

  // Outside ward warning — auto-dismisses after 4 seconds
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
  const {
    pendingCount,
    parkedCount,
    parkedItems,
    isSyncing,
    refresh: refreshSyncCount,
    retryParked,
    discardParked,
  } = useOfflineSync(saveCanvassResponse);

  const [showParkedPanel, setShowParkedPanel] = useState(false);

  const [swFailure, setSwFailure] = useState(false);

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

  function markSavedAndAdvance(entryPersonId: string, fromIndex: number) {
    const newSaved = new Set(savedSetRef.current);
    newSaved.add(entryPersonId);
    setSavedSet(newSaved);

    const currentEntries = entriesRef.current;
    for (let i = fromIndex + 1; i < currentEntries.length; i++) {
      if (!newSaved.has(currentEntries[i].person.id)) {
        setCurrentIndex(i);
        setDraft(emptyDraft());
        setError(null);
        setSelectedPersonId(currentEntries[i].person.id);
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
        setSelectedPersonId(currentEntries[i].person.id);
        return;
      }
    }
    setDone(true);
  }

  function handlePrevious() {
    if (currentIndex <= 0) return;
    const prevIndex = currentIndex - 1;
    const prevEntry = entries[prevIndex];
    setCurrentIndex(prevIndex);
    setDraft(draftFromLastResponse(prevEntry.lastResponse));
    setError(null);
    setSelectedPersonId(prevEntry.person.id);
  }

  async function handleNotHome() {
    if (isPending) return;
    setError(null);
    const capturedIndex = currentIndex;
    const capturedEntryPersonId = current.person.id;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const { isDuplicate } = await enqueue({
          assignmentId,
          personId: capturedEntryPersonId,
          outcome: "not_home",
          supportLevel: "not_home",
          wantsSign: false,
          isVolunteer: false,
          isDonorInterest: false,
          notes: "",
          competitorId: null,
          needsFollowUp: false,
        });
        if (!isDuplicate) await refreshSyncCount();
        markSavedAndAdvance(capturedEntryPersonId, capturedIndex);
      } catch (err) {
        console.error("[CanvassScreen] IndexedDB enqueue failed:", err);
        setError("Failed to save offline. Please try again.");
      }
      return;
    }

    startTransition(async () => {
      const result = await saveCanvassResponse({
        assignmentId,
        personId: capturedEntryPersonId,
        outcome: "not_home",
        supportLevel: "not_home",
        signRequest: false,
        volunteerInterest: false,
        donorInterest: false,
        notes: "",
        needsFollowUp: false,
      });
      if (result.error) { setError(result.error); return; }
      markSavedAndAdvance(capturedEntryPersonId, capturedIndex);
    });
  }

  // Level 3 (undecided) — tapping a button immediately saves and advances
  async function handleQuickOutcomeSave(outcome: CanvassOutcome) {
    if (isPending) return;
    setError(null);
    const capturedIndex = currentIndex;
    const capturedApiPersonId = selectedPersonId;
    const capturedEntryPersonId = current.person.id;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const { isDuplicate } = await enqueue({
          assignmentId,
          personId: capturedApiPersonId,
          outcome,
          supportLevel: null,
          wantsSign: false,
          isVolunteer: false,
          isDonorInterest: false,
          notes: "",
          competitorId: null,
          needsFollowUp: false,
        });
        if (!isDuplicate) await refreshSyncCount();
        markSavedAndAdvance(capturedEntryPersonId, capturedIndex);
      } catch (err) {
        console.error("[CanvassScreen] IndexedDB enqueue failed:", err);
        setError("Failed to save offline. Please try again.");
      }
      return;
    }

    startTransition(async () => {
      const result = await saveCanvassResponse({
        assignmentId,
        personId: capturedApiPersonId,
        outcome,
        supportLevel: null,
        signRequest: false,
        volunteerInterest: false,
        donorInterest: false,
        notes: "",
        needsFollowUp: false,
      });
      if (result.error) { setError(result.error); return; }
      markSavedAndAdvance(capturedEntryPersonId, capturedIndex);
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
    const capturedApiPersonId = selectedPersonId;
    const capturedEntryPersonId = current.person.id;

    const competitorId = otherOutcome === "other_candidate" ? draft.competitorId : null;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const { isDuplicate } = await enqueue({
          assignmentId,
          personId: capturedApiPersonId,
          outcome,
          supportLevel: otherOutcome ? null : supportLevel,
          wantsSign: otherOutcome ? false : draft.signRequest,
          isVolunteer: otherOutcome ? false : draft.volunteerInterest,
          isDonorInterest: otherOutcome ? false : draft.donorInterest,
          notes: draft.notes,
          needsFollowUp: draft.needsFollowUp,
          competitorId,
        });
        if (!isDuplicate) await refreshSyncCount();
        markSavedAndAdvance(capturedEntryPersonId, capturedIndex);
      } catch (err) {
        console.error("[CanvassScreen] IndexedDB enqueue failed:", err);
        setError("Failed to save offline. Please try again.");
      }
      return;
    }

    startTransition(async () => {
      const result = await saveCanvassResponse({
        assignmentId,
        personId: capturedApiPersonId,
        outcome,
        supportLevel: otherOutcome ? null : supportLevel,
        signRequest: otherOutcome ? false : draft.signRequest,
        volunteerInterest: otherOutcome ? false : draft.volunteerInterest,
        donorInterest: otherOutcome ? false : draft.donorInterest,
        notes: draft.notes,
        needsFollowUp: draft.needsFollowUp,
        competitorId,
        appointmentDate: draft.scheduleAppointment ? draft.appointmentDate : null,
        appointmentTime: draft.scheduleAppointment ? draft.appointmentTime : null,
      });
      if (result.error) { setError(result.error); return; }
      markSavedAndAdvance(capturedEntryPersonId, capturedIndex);
    });
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  // Levels 1/2 — show Sign, Volunteer, Potential Donor chips
  const isYesLevel = draft.supportLevel === "strong_yes" || draft.supportLevel === "soft_yes";
  // Level 3 — show immediate-save outcome buttons
  const isUndecided = draft.supportLevel === "undecided";
  // Levels 4/5 — show Other Candidate button
  const isNoLevel = draft.supportLevel === "soft_no" || draft.supportLevel === "strong_no";

  const showDetails = isYesLevel || isNoLevel;
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

  // Building context: how many entries share this base address, and which position is this.
  const buildingBaseKey = addr ? `${addr.streetNumber} ${addr.streetName}` : null;
  const buildingEntries = buildingBaseKey
    ? entries.filter(e => {
        const a = e.person.address;
        return a && `${a.streetNumber} ${a.streetName}` === buildingBaseKey;
      })
    : [];
  const isMultiUnit = buildingEntries.length > 1;
  const buildingPosition = isMultiUnit
    ? buildingEntries.findIndex(e => e.person.id === current.person.id) + 1
    : 0;

  function fmtAddr(a: typeof addr): string {
    if (!a) return "";
    return `${a.streetNumber} ${a.streetName}${a.unitNumber ? ` #${a.unitNumber}` : ""}, ${a.city}, ${a.province}`;
  }

  const mapsUrl = addr
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fmtAddr(addr))}&travelmode=walking`
    : null;

  // "Navigate to next" — walking directions from current stop to next stop
  const nextEntry = entries[currentIndex + 1] ?? null;
  const nextAddr = nextEntry?.person?.address ?? null;
  const navToNextUrl =
    addr && nextAddr
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fmtAddr(addr))}&destination=${encodeURIComponent(fmtAddr(nextAddr))}&travelmode=walking`
      : null;

  // Walk estimate to next stop — Haversine distance at 5 km/h walking speed
  const isLastEntry = currentIndex >= entries.length - 1;
  const walkMinutes = (() => {
    if (!addr?.lat || !addr?.lng || !nextAddr?.lat || !nextAddr?.lng) return null;
    const km = haversineKm(addr.lat, addr.lng, nextAddr.lat, nextAddr.lng);
    return Math.max(1, Math.round((km / 5) * 60));
  })();

  // All people at this door — main person first, then co-residents
  const allResidents = [
    { id: current.person.id, firstName: current.person.firstName, lastName: current.person.lastName },
    ...coResidents,
  ];

  // ── Active canvassing screen ──────────────────────────────────────────────

  return (
    <div className="h-screen [height:100dvh] bg-slate-50 flex flex-col overflow-hidden">

      {/* SW failure warning */}
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
            <p className="text-xl font-extrabold text-slate-900 leading-tight">{addressLine}</p>
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
                {navToNextUrl && (
                  <a
                    href={navToNextUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-[11px] font-medium hover:bg-slate-100 active:bg-slate-200 transition-colors"
                  >
                    <Navigation className="h-3 w-3" />
                    Next stop
                  </a>
                )}
              </div>
            </div>
            {(isLastEntry || walkMinutes !== null) && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isLastEntry ? "Last stop on route" : `~${walkMinutes} min walk to next`}
              </p>
            )}
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
                        const ok = window.confirm(
                          "This number is listed as a home phone and may not receive text messages. Send SMS anyway?"
                        );
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
          </div>

          {/* ── Resident queue — tap to select who you're speaking with ── */}
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

          {/* ── Canvassing script panel — collapsible ── */}
          {canvassScript && (
            <div className="mb-1.5">
              <button
                type="button"
                onClick={() => setShowScript((v) => !v)}
                className="w-full h-9 flex items-center justify-between px-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <span className="text-xs font-medium">{showScript ? "Hide script" : "View script"}</span>
                <svg
                  className={["h-3.5 w-3.5 transition-transform", showScript ? "rotate-180" : ""].join(" ")}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showScript && (
                <div className="mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{canvassScript}</p>
                </div>
              )}
            </div>
          )}

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

          {/* ── Levels 1/2 — Sign, Volunteer, Potential Donor chips ── */}
          {isYesLevel && (
            <div className="flex gap-2 mb-1.5">
              {[
                { label: "Sign",            checked: draft.signRequest,       toggle: () => setDraft((d) => ({ ...d, signRequest: !d.signRequest })) },
                { label: "Volunteer",       checked: draft.volunteerInterest, toggle: () => setDraft((d) => ({ ...d, volunteerInterest: !d.volunteerInterest })) },
                { label: "Potential Donor", checked: draft.donorInterest,     toggle: () => setDraft((d) => ({ ...d, donorInterest: !d.donorInterest })) },
              ].map(({ label, checked, toggle }) => (
                <button
                  key={label}
                  type="button"
                  onClick={toggle}
                  className={[
                    "h-10 px-3 rounded-xl border-2 text-xs font-medium transition-all flex items-center justify-center flex-1",
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

          {/* ── Level 3 — Refused / Moved / Unavailable / Deceased (immediate save) ── */}
          {isUndecided && (
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
              {LEVEL_3_OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => handleQuickOutcomeSave(o.value)}
                  disabled={isPending}
                  className="h-11 rounded-xl border border-slate-200 bg-white font-medium text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Levels 4/5 — Other Candidate ── */}
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
            </div>
          )}

          {/* ── Details panel — notes + follow-up + appointment ── */}
          {showDetails && (
            <div className="bg-white border-t-2 border-slate-200 divide-y divide-slate-100 mt-1.5">
              <CompactToggle
                label="Needs follow-up"
                checked={draft.needsFollowUp}
                onChange={(v) => setDraft((d) => ({ ...d, needsFollowUp: v }))}
              />
              <CompactToggle
                label="Schedule appointment"
                checked={draft.scheduleAppointment}
                onChange={(v) => setDraft((d) => ({ ...d, scheduleAppointment: v }))}
              />
              {draft.scheduleAppointment && (
                <div className="px-4 py-2 flex gap-2">
                  <input
                    type="date"
                    value={draft.appointmentDate}
                    onChange={(e) => setDraft((d) => ({ ...d, appointmentDate: e.target.value }))}
                    className="flex-1 h-9 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <input
                    type="time"
                    value={draft.appointmentTime}
                    onChange={(e) => setDraft((d) => ({ ...d, appointmentTime: e.target.value }))}
                    className="w-28 h-9 px-3 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              )}
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
      <OfflinePill
        pendingCount={pendingCount}
        parkedCount={parkedCount}
        isSyncing={isSyncing}
        onOpenParked={() => setShowParkedPanel(true)}
      />

      {/* ── Parked items panel ── */}
      {showParkedPanel && (
        <ParkedPanel
          parkedItems={parkedItems}
          entries={entries}
          onRetry={async (id) => { await retryParked(id); }}
          onDiscard={async (id) => { await discardParked(id); }}
          onClose={() => setShowParkedPanel(false)}
        />
      )}

      {/* ── Zone 3: Actions — pinned bottom, clears mobile nav ── */}
      <footer className="flex-none bg-white border-t border-slate-100 px-4 pt-2 pb-16">
        {error && (
          <p className="text-xs text-red-600 text-center mb-1.5">{error}</p>
        )}

        {/* ── Edit record confirmation ── */}
        {showEditConfirm && (
          <div className="max-w-lg mx-auto mb-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
            <p className="text-sm font-semibold text-slate-900 mb-0.5">Edit this record?</p>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Changes will be submitted for review and won&apos;t update the record until a manager approves.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowEditConfirm(false); setShowVoterChangeModal(true); }}
                className="flex-1 h-10 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition-colors"
              >
                Yes, edit
              </button>
              <button
                type="button"
                onClick={() => setShowEditConfirm(false)}
                className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-white active:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Add resident confirmation ── */}
        {showAddResidentConfirm && (
          <div className="max-w-lg mx-auto mb-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
            <p className="text-sm font-semibold text-slate-900 mb-0.5">Add a new resident?</p>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              This will be submitted for review and won&apos;t appear in the voter list until a manager approves.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowAddResidentConfirm(false); setShowAddResidentModal(true); }}
                className="flex-1 h-10 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition-colors"
              >
                Yes, add
              </button>
              <button
                type="button"
                onClick={() => setShowAddResidentConfirm(false)}
                className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-white active:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 max-w-lg mx-auto">
          {/* Row 1 — secondary actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowEditConfirm((v) => !v); setShowAddResidentConfirm(false); }}
              disabled={isPending}
              className="flex-1 h-12 rounded-2xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Edit Record
            </button>
            <button
              type="button"
              onClick={() => { setShowAddResidentConfirm((v) => !v); setShowEditConfirm(false); }}
              disabled={isPending}
              className="flex-1 h-12 rounded-2xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Add Resident
            </button>
          </div>
          {/* Row 2 — primary actions: back | skip | save and next */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={isPending || currentIndex === 0}
              aria-label="Previous person"
              className="h-12 w-12 flex-shrink-0 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={isPending}
              className="flex-1 h-12 rounded-2xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50"
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
        </div>
      </footer>

      {showVoterChangeModal && (
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

// ── Offline sync pill ──────────────────────────────────────────────────────

function OfflinePill({
  pendingCount,
  parkedCount,
  isSyncing,
  onOpenParked,
}: {
  pendingCount: number;
  parkedCount: number;
  isSyncing: boolean;
  onOpenParked: () => void;
}) {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!isOnline) {
    return (
      <div className="fixed bottom-36 left-4 z-10 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full">
        Offline · {pendingCount} queued
      </div>
    );
  }

  if (parkedCount > 0) {
    return (
      <button
        type="button"
        onClick={onOpenParked}
        className="fixed bottom-36 left-4 z-10 bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-3 py-1.5 rounded-full active:bg-red-100 transition-colors"
      >
        {parkedCount} failed · review
      </button>
    );
  }

  if (isSyncing) {
    return (
      <div className="fixed bottom-36 left-4 z-10 bg-white border border-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded-full">
        Syncing…
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="fixed bottom-36 left-4 z-10 bg-white border border-slate-200 text-slate-500 text-xs px-3 py-1.5 rounded-full">
        {pendingCount} to sync
      </div>
    );
  }

  return null;
}

// ── Parked items panel ─────────────────────────────────────────────────────

function ParkedPanel({
  parkedItems,
  entries,
  onRetry,
  onDiscard,
  onClose,
}: {
  parkedItems: QueuedResponse[];
  entries: LocalEntry[];
  onRetry: (id: string) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  function personName(personId: string): string {
    const entry = entries.find((e) => e.person.id === personId);
    if (!entry) return "Unknown person";
    return `${entry.person.firstName} ${entry.person.lastName}`;
  }

  async function handleRetry(id: string) {
    setBusy(id);
    await onRetry(id);
    setBusy(null);
  }

  async function handleDiscard(id: string) {
    setBusy(id);
    await onDiscard(id);
    setBusy(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[70vh] flex flex-col">
        {/* Handle + header */}
        <div className="flex-none px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Failed to sync</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {parkedItems.length} {parkedItems.length === 1 ? "response" : "responses"} could not be saved
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Item list */}
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {parkedItems.map((item) => (
            <li key={item.id} className="px-5 py-3.5">
              <p className="text-sm font-semibold text-slate-900 mb-0.5">{personName(item.personId)}</p>
              {item.lastError && (
                <p className="text-xs text-red-600 mb-2">{item.lastError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRetry(item.id)}
                  disabled={busy === item.id}
                  className="h-8 px-3 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50"
                >
                  {busy === item.id ? "…" : "Retry"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscard(item.id)}
                  disabled={busy === item.id}
                  className="h-8 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Discard
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
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

export type { LocalEntry };
