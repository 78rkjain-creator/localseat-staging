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
import type { FieldMessageItem } from "@/lib/field-messages";
import { FieldMessagesBanner } from "@/components/field-messages-banner";
import { SurveyPanel } from "@/components/survey-panel";
import type { ActiveSurvey } from "@/lib/surveys";
import { SignatureModal } from "@/components/signature-modal";
import { saveSignature } from "@/app/(app)/people/[personId]/signature-actions";
import { DemoHint } from "@/components/demo/demo-hint";
import { SUPPORT_LEVEL_LABELS } from "@/types";

type SortMode = "default" | "nearest";
type ParityFilter = "all" | "even" | "odd";

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
  outcomeDetail: string | null;
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
    outcomeDetail: null,
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
  { value: "strong_yes", numeral: 5, caption: "Yes+", style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { value: "soft_yes",   numeral: 4, caption: "Yes",  style: "border-emerald-100 bg-white text-emerald-600" },
  { value: "undecided",  numeral: 3, caption: "?",    style: "border-amber-200 bg-amber-50 text-amber-700" },
  { value: "soft_no",    numeral: 2, caption: "No",   style: "border-orange-200 bg-orange-50 text-orange-700" },
  { value: "strong_no",  numeral: 1, caption: "No−",  style: "border-red-200 bg-red-50 text-red-700" },
];

// Not-home dropdown options — ordered by frequency
const NOT_HOME_OUTCOMES: { value: CanvassOutcome; label: string }[] = [
  { value: "not_home",        label: "Not home" },
  { value: "moved",           label: "Moved" },
  { value: "unavailable",     label: "Unavailable" },
  { value: "language_barrier", label: "Language barrier" },
  { value: "deceased",        label: "Deceased" },
];

// Support level 3 sub-options
const UNDECIDED_SUB_OPTIONS: { value: string; label: string }[] = [
  { value: "wont_say",       label: "Won't say" },
  { value: "still_deciding", label: "Still deciding" },
  { value: "needs_info",     label: "Needs more info" },
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
  fieldMessages?: FieldMessageItem[];
  activeSurvey?: ActiveSurvey | null;
  consentTypes?: { id: string; label: string }[];
  demoMode?: boolean;
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
  fieldMessages = [],
  activeSurvey = null,
  consentTypes = [],
  demoMode = false,
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

  // Shift summary: track what was already done when the session started
  const [sessionStartTime] = useState(() => new Date());
  const [preSavedIds] = useState(
    () => new Set(entries.filter((e) => e.lastResponse).map((e) => e.person.id))
  );
  const [sessionStats, setSessionStats] = useState({
    contacted: 0,
    notHome: 0,
    supportYes: 0,
    signs: 0,
    volunteers: 0,
  });

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

  const [showNotHomeMenu, setShowNotHomeMenu] = useState(false);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, unknown>>({});

  // ── Sort & filter controls ──────────────────────────────────────────────
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [parityFilter, setParityFilter] = useState<ParityFilter>("all");
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState(false);

  // Request GPS when user switches to "nearest" sort
  useEffect(() => {
    if (sortMode !== "nearest") return;
    if (gpsPosition) return; // already have it
    if (!navigator.geolocation) { setGpsError(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGpsPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGpsError(true),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [sortMode, gpsPosition]);

  // Derive the sorted + filtered entry list
  const displayEntries = (() => {
    let list = [...entries];

    // Parity filter
    if (parityFilter !== "all") {
      list = list.filter((e) => {
        const num = parseInt(e.person.address?.streetNumber ?? "0", 10);
        if (isNaN(num)) return true; // keep entries without a parseable number
        return parityFilter === "even" ? num % 2 === 0 : num % 2 !== 0;
      });
    }

    // Sort by proximity to GPS
    if (sortMode === "nearest" && gpsPosition) {
      list.sort((a, b) => {
        const aAddr = a.person.address;
        const bAddr = b.person.address;
        const aDist = aAddr?.lat && aAddr?.lng
          ? haversineKm(gpsPosition.lat, gpsPosition.lng, aAddr.lat, aAddr.lng)
          : Infinity;
        const bDist = bAddr?.lat && bAddr?.lng
          ? haversineKm(gpsPosition.lat, gpsPosition.lng, bAddr.lat, bAddr.lng)
          : Infinity;
        return aDist - bDist;
      });
    }

    return list;
  })();
  const displayEntriesRef = useRef(displayEntries);
  displayEntriesRef.current = displayEntries;
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showParkedPanel, setShowParkedPanel] = useState(false);

  const [swFailure, setSwFailure] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setSwFailure(true);
      return;
    }
    // Registration happens globally in layout. Here we just check whether a SW
    // becomes active within 4 s so we can warn if offline caching is unavailable.
    const t = setTimeout(() => setSwFailure(true), 4000);
    navigator.serviceWorker.ready
      .then(() => clearTimeout(t))
      .catch(() => { clearTimeout(t); setSwFailure(true); });
  }, []);

  // Clamp currentIndex when displayEntries shrinks (e.g. parity filter)
  useEffect(() => {
    if (displayEntries.length > 0 && currentIndex >= displayEntries.length) {
      setCurrentIndex(0);
    }
  }, [displayEntries.length, currentIndex]);

  const current = displayEntries.length > 0 ? displayEntries[currentIndex] : null;
  const totalCount = entries.length;
  const doneCount = savedSet.size;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function markSavedAndAdvance(entryPersonId: string, fromIndex: number) {
    const newSaved = new Set(savedSetRef.current);
    const isNewSave = !preSavedIds.has(entryPersonId);
    newSaved.add(entryPersonId);
    setSavedSet(newSaved);

    // Track session stats for the shift summary
    if (isNewSave) {
      setSessionStats((prev) => {
        const d = draft;
        const isContacted = !d.otherOutcome || d.otherOutcome === undefined;
        return {
          contacted: prev.contacted + (isContacted ? 1 : 0),
          notHome: prev.notHome + (isContacted ? 0 : 1),
          supportYes: prev.supportYes + ((d.supportLevel === "strong_yes" || d.supportLevel === "soft_yes") ? 1 : 0),
          signs: prev.signs + (d.signRequest ? 1 : 0),
          volunteers: prev.volunteers + (d.volunteerInterest ? 1 : 0),
        };
      });
    }

    const currentEntries = displayEntriesRef.current;
    for (let i = fromIndex + 1; i < currentEntries.length; i++) {
      if (!newSaved.has(currentEntries[i].person.id)) {
        setCurrentIndex(i);
        setDraft(emptyDraft());
        setSurveyAnswers({});
        setError(null);
        setSelectedPersonId(currentEntries[i].person.id);
        return;
      }
    }
    setDone(true);
  }

  function handleSkip() {
    setError(null);
    const currentEntries = displayEntriesRef.current;
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
    const prevEntry = displayEntries[prevIndex];
    setCurrentIndex(prevIndex);
    setDraft(draftFromLastResponse(prevEntry.lastResponse));
    setError(null);
    setSelectedPersonId(prevEntry.person.id);
  }

  // Unified auto-save — fires for not-home options, support 1/2/4/5 taps, and sub-option taps.
  // Captures current draft state (notes, toggles, follow-up) at call time.
  async function handleAutoSave(params: {
    outcome: CanvassOutcome;
    supportLevel: SupportLevel | null;
    outcomeDetail?: string | null;
  }) {
    if (!current) return;
    if (isPending) return;
    setError(null);
    setShowNotHomeMenu(false);

    const capturedIndex = currentIndex;
    const capturedEntryPersonId = current.person.id;
    const capturedApiPersonId = selectedPersonId;
    const isContacted = params.outcome === "contacted";
    const capturedNotes = draft.notes;
    const capturedSign = isContacted ? draft.signRequest : false;
    const capturedVolunteer = isContacted ? draft.volunteerInterest : false;
    const capturedDonor = isContacted ? draft.donorInterest : false;
    const capturedFollowUp = draft.needsFollowUp;
    const capturedCompetitorId =
      params.outcome === "other_candidate" ? (draft.competitorId ?? null) : null;
    const capturedDetail = params.outcomeDetail ?? null;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const { isDuplicate } = await enqueue({
          assignmentId,
          personId: capturedApiPersonId,
          outcome: params.outcome,
          supportLevel: params.supportLevel,
          wantsSign: capturedSign,
          isVolunteer: capturedVolunteer,
          isDonorInterest: capturedDonor,
          notes: capturedNotes,
          competitorId: capturedCompetitorId,
          needsFollowUp: capturedFollowUp,
          outcomeDetail: capturedDetail,
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
        outcome: params.outcome,
        supportLevel: params.supportLevel,
        signRequest: capturedSign,
        volunteerInterest: capturedVolunteer,
        donorInterest: capturedDonor,
        notes: capturedNotes,
        needsFollowUp: capturedFollowUp,
        competitorId: capturedCompetitorId,
        outcomeDetail: capturedDetail,
        surveyId: activeSurvey?.id ?? null,
        surveyAnswers: Object.keys(surveyAnswers).length > 0 ? surveyAnswers : null,
      });
      if (result.error) { setError(result.error); return; }
      markSavedAndAdvance(capturedEntryPersonId, capturedIndex);
    });
  }

  async function handleSave() {
    if (!current) return;
    const { supportLevel, otherOutcome, outcomeDetail } = draft;
    if (!supportLevel && !otherOutcome) return;
    if (isPending) return;
    setError(null);

    const outcome: CanvassOutcome = otherOutcome ?? "contacted";
    const isContacted = outcome === "contacted";

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
          supportLevel: isContacted ? supportLevel : null,
          wantsSign: isContacted ? draft.signRequest : false,
          isVolunteer: isContacted ? draft.volunteerInterest : false,
          isDonorInterest: isContacted ? draft.donorInterest : false,
          notes: draft.notes,
          needsFollowUp: draft.needsFollowUp,
          competitorId,
          outcomeDetail: isContacted ? (outcomeDetail ?? null) : null,
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
        supportLevel: isContacted ? supportLevel : null,
        signRequest: isContacted ? draft.signRequest : false,
        volunteerInterest: isContacted ? draft.volunteerInterest : false,
        donorInterest: isContacted ? draft.donorInterest : false,
        notes: draft.notes,
        needsFollowUp: draft.needsFollowUp,
        competitorId,
        outcomeDetail: isContacted ? (outcomeDetail ?? null) : null,
        appointmentDate: draft.scheduleAppointment ? draft.appointmentDate : null,
        appointmentTime: draft.scheduleAppointment ? draft.appointmentTime : null,
        surveyId: activeSurvey?.id ?? null,
        surveyAnswers: Object.keys(surveyAnswers).length > 0 ? surveyAnswers : null,
      });
      if (result.error) { setError(result.error); return; }
      markSavedAndAdvance(capturedEntryPersonId, capturedIndex);
    });
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  // Level 3 selected in draft — show sub-options
  const isUndecided = draft.supportLevel === "undecided";
  // Levels 4/5 — show Other Candidate button
  const isNoLevel = draft.supportLevel === "soft_no" || draft.supportLevel === "strong_no";

  // Save and next is valid when level 3 is selected (explicit commit) or other_candidate is set
  const canSave = (draft.supportLevel === "undecided" || !!draft.otherOutcome) && !isPending;

  // ── Done screen ───────────────────────────────────────────────────────────

  if (done || entries.length === 0) {
    // Calculate shift stats from this session
    const sessionDoors = Array.from(savedSet).filter((id) => !preSavedIds.has(id)).length;
    const sessionMinutes = Math.round((Date.now() - sessionStartTime.getTime()) / 60000);
    const sessionHours = Math.floor(sessionMinutes / 60);
    const sessionMins = sessionMinutes % 60;
    const timeLabel = sessionHours > 0 ? `${sessionHours}h ${sessionMins}m` : `${sessionMins}m`;
    const doorsPerHour = sessionMinutes > 0 ? Math.round((sessionDoors / sessionMinutes) * 60) : 0;

    const { contacted, notHome, supportYes, signs, volunteers } = sessionStats;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
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
            {/* Shift summary card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 text-center" style={{ background: "linear-gradient(135deg, #065f46, #047857)" }}>
                <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-white">Shift complete</h1>
                <p className="text-emerald-200 text-sm mt-1">Great work out there.</p>
              </div>

              {/* Stats */}
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

                {/* Progress */}
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span>List progress</span>
                    <span className="font-semibold tabular-nums">{doneCount}/{totalCount}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Link
                href="/dashboard"
                className="flex items-center justify-center h-12 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-2xl text-sm transition-colors"
              >
                Back to dashboard
              </Link>
              <Link
                href="/canvassing"
                className="flex items-center justify-center h-12 border border-slate-200 bg-white text-slate-700 font-medium rounded-2xl text-sm hover:bg-slate-50 transition-colors"
              >
                My walk lists
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  const addr = current?.person.address;
  const addressLine = addr
    ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
    : "Unknown address";
  const cityLine = addr ? `${addr.city}, ${addr.province}` : "";
  const coResidents = current?.person.coResidents ?? [];

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
    ? buildingEntries.findIndex(e => e.person.id === current?.person.id) + 1
    : 0;

  function fmtAddr(a: typeof addr): string {
    if (!a) return "";
    return `${a.streetNumber} ${a.streetName}${a.unitNumber ? ` #${a.unitNumber}` : ""}, ${a.city}, ${a.province}`;
  }

  const mapsUrl = addr
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fmtAddr(addr))}&travelmode=walking`
    : null;

  // "Navigate to next" — walking directions from current stop to next stop
  const nextEntry = displayEntries[currentIndex + 1] ?? null;
  const nextAddr = nextEntry?.person?.address ?? null;
  const navToNextUrl =
    addr && nextAddr
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fmtAddr(addr))}&destination=${encodeURIComponent(fmtAddr(nextAddr))}&travelmode=walking`
      : null;

  // Walk estimate to next stop — Haversine distance at 5 km/h walking speed
  const isLastEntry = currentIndex >= displayEntries.length - 1;
  const walkMinutes = (() => {
    if (!addr?.lat || !addr?.lng || !nextAddr?.lat || !nextAddr?.lng) return null;
    const km = haversineKm(addr.lat, addr.lng, nextAddr.lat, nextAddr.lng);
    return Math.max(1, Math.round((km / 5) * 60));
  })();

  // All people at this door — main person first, then co-residents
  const allResidents = current ? [
    { id: current.person.id, firstName: current.person.firstName, lastName: current.person.lastName },
    ...coResidents,
  ] : [];

  // ── Active canvassing screen ──────────────────────────────────────────────

  return (
    <div className="h-screen [height:100dvh] bg-slate-50 flex flex-col overflow-hidden">

      <DemoHint
        demoMode={demoMode}
        storageKey="demo-hint-canvass-screen"
        hint="Tap a support level (1–5), toggle sign or volunteer interest, then hit Save & next. All responses are recorded to the campaign dashboard."
      />

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

      {/* Field messages */}
      {fieldMessages.length > 0 && (
        <div className="flex-none px-3 pt-2">
          <FieldMessagesBanner messages={fieldMessages} />
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

      {/* ── Sort & filter bar ── */}
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

      {/* ── Zone 2: Controls — flex-1, scrollable for survey ── */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 pt-1.5 pb-4 max-w-lg mx-auto">

          {/* No entries after filter */}
          {displayEntries.length === 0 && entries.length > 0 && (
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
          )}

          {current && (<>
          {/* ── Household hero ── */}
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
            {current.person.doNotContact && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
                <svg className="h-4 w-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <p className="text-xs font-semibold text-red-600">Do not contact — skip this door</p>
              </div>
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

          {/* ── Not home button + dropdown ── */}
          <div className="relative mb-1.5">
            {showNotHomeMenu && (
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowNotHomeMenu(false)}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              onClick={() => setShowNotHomeMenu((v) => !v)}
              disabled={isPending}
              className={[
                "w-full h-12 flex items-center justify-between px-4 rounded-2xl border-2 font-semibold text-sm transition-all disabled:opacity-50",
                showNotHomeMenu
                  ? "border-slate-700 bg-slate-700 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:bg-slate-100",
              ].join(" ")}
            >
              <span>Not home</span>
              <svg
                className={["h-4 w-4 transition-transform", showNotHomeMenu ? "rotate-180" : ""].join(" ")}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showNotHomeMenu && (
              <div className="absolute top-full left-0 right-0 z-30 bg-white rounded-2xl border border-slate-200 shadow-lg mt-1 overflow-hidden">
                {NOT_HOME_OUTCOMES.map((o, idx) => (
                  <button
                    key={o.value}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAutoSave({ outcome: o.value, supportLevel: null })}
                    className={[
                      "w-full px-4 py-3.5 text-sm font-medium text-slate-700 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50",
                      idx < NOT_HOME_OUTCOMES.length - 1 ? "border-b border-slate-100" : "",
                    ].join(" ")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
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
                  disabled={isPending}
                  onClick={() => {
                    if (s.numeral === 3) {
                      // Level 3: reveal sub-options, don't auto-save
                      setDraft((d) => ({
                        ...d,
                        supportLevel: isActive ? null : s.value,
                        outcomeDetail: null,
                        otherOutcome: null,
                      }));
                    } else if (draft.otherOutcome === "other_candidate") {
                      // Other candidate flow: just set level, use Save and next
                      setDraft((d) => ({ ...d, supportLevel: isActive ? null : s.value }));
                    } else {
                      // Levels 1, 2, 4, 5: auto-save immediately
                      void handleAutoSave({ outcome: "contacted", supportLevel: s.value });
                    }
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

          {/* ── Level 3 sub-options: Won't say / Still deciding / Needs more info ── */}
          {isUndecided && (
            <div className="grid grid-cols-3 gap-1.5 mb-1.5">
              {UNDECIDED_SUB_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    handleAutoSave({ outcome: "contacted", supportLevel: "undecided", outcomeDetail: o.value })
                  }
                  className="h-11 rounded-xl border border-slate-200 bg-white font-medium text-xs text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-all"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Notes — always visible so canvasser can type before selecting outcome ── */}
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder="Note (optional)…"
            rows={2}
            className="w-full px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none bg-slate-50 rounded-xl border border-slate-200 block mb-1.5"
          />

          {/* ── Toggles — always visible so canvasser can set before selecting outcome ── */}
          <div className="flex gap-2 mb-1.5">
            {[
              { label: "Sign",      checked: draft.signRequest,       toggle: () => setDraft((d) => ({ ...d, signRequest: !d.signRequest })) },
              { label: "Volunteer", checked: draft.volunteerInterest, toggle: () => setDraft((d) => ({ ...d, volunteerInterest: !d.volunteerInterest })) },
              { label: "Donor",     checked: draft.donorInterest,     toggle: () => setDraft((d) => ({ ...d, donorInterest: !d.donorInterest })) },
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

          {/* ── Follow-up + appointment — always available ── */}
          <div className="bg-slate-50 rounded-xl divide-y divide-slate-100 mb-1.5">
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
          </div>

          {/* ── Other Candidate — only when 4/5 in draft (explicit commit via Save and next) ── */}
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

          {/* ── Survey panel ── */}
          {activeSurvey && (
            <SurveyPanel
              survey={activeSurvey}
              answers={surveyAnswers}
              onChange={setSurveyAnswers}
            />
          )}

          </>)}
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
            <button
              type="button"
              onClick={() => setShowSignatureModal(true)}
              disabled={isPending}
              aria-label="Collect signature"
              className="h-12 w-12 flex-shrink-0 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
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
                "flex-1 h-14 rounded-2xl font-bold text-base transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                canSave
                  ? "bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-md shadow-orange-200/50"
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

      {showSignatureModal && (
        <SignatureModal
          personId={selectedPersonId}
          consentTypes={consentTypes}
          onClose={() => setShowSignatureModal(false)}
          onSave={saveSignature}
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
