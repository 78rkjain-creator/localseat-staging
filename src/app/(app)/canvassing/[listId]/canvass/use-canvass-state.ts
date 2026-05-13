"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { saveCanvassResponse } from "./actions";
import type { CanvassingQueue } from "@/lib/canvassing";
import type { SupportLevel, CanvassOutcome } from "@/types";
import { enqueue } from "@/lib/offline-queue";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import type { ActiveSurvey } from "@/lib/surveys";

// ── Types ──────────────────────────────────────────────────────────────────

export type SortMode = "default" | "nearest";
export type ParityFilter = "all" | "even" | "odd";

export type LocalEntry = CanvassingQueue["entries"][number] & {
  person: {
    phoneMobile: string | null;
    email: string | null;
    birthDate: Date | null;
    coResidents: { id: string; firstName: string; lastName: string }[];
  };
};

export interface ResponseDraft {
  supportLevel: SupportLevel | null;
  otherOutcome: CanvassOutcome | null;
  outcomeDetail: string | null;
  signRequest: boolean;
  volunteerInterest: boolean;
  donorInterest: boolean;
  notes: string;
  needsFollowUp: boolean;
  competitorId: string | null;
}

export function emptyDraft(): ResponseDraft {
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
  };
}

export function draftFromLastResponse(
  response: { supportLevel: string | null } | null
): ResponseDraft {
  if (!response) return emptyDraft();
  return {
    ...emptyDraft(),
    supportLevel: (response.supportLevel as SupportLevel | null) ?? null,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function formatVisitDate(iso: string | Date): string {
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

export function fmtApptBadge(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ── Constants ──────────────────────────────────────────────────────────────

export const SCALE_BUTTONS: {
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

export const NOT_HOME_OUTCOMES: { value: CanvassOutcome; label: string }[] = [
  { value: "not_home",        label: "Not home" },
  { value: "moved",           label: "Moved" },
  { value: "unavailable",     label: "Unavailable" },
  { value: "language_barrier", label: "Language barrier" },
  { value: "deceased",        label: "Deceased" },
];

export const UNDECIDED_SUB_OPTIONS: { value: string; label: string }[] = [
  { value: "wont_say",       label: "Won't say" },
  { value: "still_deciding", label: "Still deciding" },
  { value: "needs_info",     label: "Needs more info" },
];

// ── Main hook ──────────────────────────────────────────────────────────────

export interface CanvassStateProps {
  listId: string;
  listName: string;
  assignmentId: string;
  campaignId: string;
  campaignCity: string;
  canvassScript: string | null;
  entries: CanvassingQueue["entries"];
  competitors: { id: string; name: string }[];
  appointmentsByPersonId: Record<string, string>;
  activeSurvey: ActiveSurvey | null;
  consentTypes: { id: string; label: string }[];
  demoMode: boolean;
}

export function useCanvassState(props: CanvassStateProps) {
  const {
    assignmentId,
    activeSurvey,
    entries: initialEntries,
  } = props;

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

  // Shift summary stats
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

  // Modals
  const [showVoterChangeModal, setShowVoterChangeModal] = useState(false);
  const [showAddResidentModal, setShowAddResidentModal] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showAddResidentConfirm, setShowAddResidentConfirm] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showParkedPanel, setShowParkedPanel] = useState(false);

  // Outside ward warning
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

  // Offline sync
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

  // Sort & filter
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [parityFilter, setParityFilter] = useState<ParityFilter>("all");
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState(false);

  // SW failure
  const [swFailure, setSwFailure] = useState(false);

  // Save flash
  const [saveFlash, setSaveFlash] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setSwFailure(true);
      return;
    }
    const t = setTimeout(() => setSwFailure(true), 4000);
    navigator.serviceWorker.ready
      .then(() => clearTimeout(t))
      .catch(() => { clearTimeout(t); setSwFailure(true); });
  }, []);

  // Request GPS when switching to "nearest" sort
  useEffect(() => {
    if (sortMode !== "nearest") return;
    if (gpsPosition) return;
    if (!navigator.geolocation) { setGpsError(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGpsPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGpsError(true),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [sortMode, gpsPosition]);

  // Derive sorted + filtered entry list
  const displayEntries = (() => {
    let list = [...entries];
    if (parityFilter !== "all") {
      list = list.filter((e) => {
        const num = parseInt(e.person.address?.streetNumber ?? "0", 10);
        if (isNaN(num)) return true;
        return parityFilter === "even" ? num % 2 === 0 : num % 2 !== 0;
      });
    }
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

  // Clamp currentIndex when displayEntries shrinks
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

  const markSavedAndAdvance = useCallback((entryPersonId: string, fromIndex: number) => {
    const newSaved = new Set(savedSetRef.current);
    const isNewSave = !preSavedIds.has(entryPersonId);
    newSaved.add(entryPersonId);
    setSavedSet(newSaved);

    if (isNewSave) {
      setSessionStats((prev) => {
        // We need to read the draft at call-time; we capture it in the calling function
        // This is called from handleSave which captures draft values
        return prev; // Updated by the calling function
      });
    }

    // Show save flash
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSavedIds]);

  const handleSkip = useCallback(() => {
    setError(null);
    const currentEntries = displayEntriesRef.current;
    for (let i = currentIndex + 1; i < currentEntries.length; i++) {
      if (!savedSetRef.current.has(currentEntries[i].person.id)) {
        setCurrentIndex(i);
        setDraft(emptyDraft());
        setSurveyAnswers({});
        setSelectedPersonId(currentEntries[i].person.id);
        return;
      }
    }
    setDone(true);
  }, [currentIndex]);

  const handlePrevious = useCallback(() => {
    if (currentIndex <= 0) return;
    const prevIndex = currentIndex - 1;
    const prevEntry = displayEntries[prevIndex];
    setCurrentIndex(prevIndex);
    setDraft(draftFromLastResponse(prevEntry.lastResponse));
    setSurveyAnswers({});
    setError(null);
    setSelectedPersonId(prevEntry.person.id);
  }, [currentIndex, displayEntries]);

  // Unified save — handles both spoke and non-spoke outcomes
  const handleSave = useCallback(async () => {
    if (!current) return;
    const { supportLevel, otherOutcome, outcomeDetail } = draft;

    // Determine outcome
    let outcome: CanvassOutcome;
    if (otherOutcome) {
      outcome = otherOutcome;
    } else if (supportLevel) {
      outcome = "contacted";
    } else {
      return; // nothing to save
    }

    if (isPending) return;
    setError(null);
    setShowNotHomeMenu(false);

    const capturedIndex = currentIndex;
    const capturedEntryPersonId = current.person.id;
    const capturedApiPersonId = selectedPersonId;
    const isContacted = outcome === "contacted";
    const capturedNotes = draft.notes;
    const capturedSign = isContacted ? draft.signRequest : false;
    const capturedVolunteer = isContacted ? draft.volunteerInterest : false;
    const capturedDonor = isContacted ? draft.donorInterest : false;
    const capturedFollowUp = draft.needsFollowUp;
    const capturedCompetitorId =
      outcome === "other_candidate" ? (draft.competitorId ?? null) : null;
    const capturedDetail = outcomeDetail ?? null;
    const capturedSupportLevel = isContacted ? supportLevel : null;

    // Update session stats
    const isNewSave = !preSavedIds.has(capturedEntryPersonId);
    if (isNewSave) {
      setSessionStats((prev) => ({
        contacted: prev.contacted + (isContacted ? 1 : 0),
        notHome: prev.notHome + (isContacted ? 0 : 1),
        supportYes: prev.supportYes + ((supportLevel === "strong_yes" || supportLevel === "soft_yes") ? 1 : 0),
        signs: prev.signs + (capturedSign ? 1 : 0),
        volunteers: prev.volunteers + (capturedVolunteer ? 1 : 0),
      }));
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const { isDuplicate } = await enqueue({
          assignmentId,
          personId: capturedApiPersonId,
          outcome,
          supportLevel: capturedSupportLevel,
          wantsSign: capturedSign,
          isVolunteer: capturedVolunteer,
          isDonorInterest: capturedDonor,
          notes: capturedNotes,
          needsFollowUp: capturedFollowUp,
          competitorId: capturedCompetitorId,
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
        outcome,
        supportLevel: capturedSupportLevel,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, draft, isPending, currentIndex, selectedPersonId, assignmentId, activeSurvey, surveyAnswers, markSavedAndAdvance, refreshSyncCount, preSavedIds]);

  // Quick save for not-home sub-reasons (sets otherOutcome and saves in one go)
  const handleNotHomeSave = useCallback(async (notHomeOutcome: CanvassOutcome) => {
    if (!current) return;
    if (isPending) return;
    setError(null);
    setShowNotHomeMenu(false);

    const capturedIndex = currentIndex;
    const capturedEntryPersonId = current.person.id;
    const capturedApiPersonId = selectedPersonId;
    const capturedNotes = draft.notes;
    const capturedFollowUp = draft.needsFollowUp;

    const isNewSave = !preSavedIds.has(capturedEntryPersonId);
    if (isNewSave) {
      setSessionStats((prev) => ({
        ...prev,
        notHome: prev.notHome + 1,
      }));
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const { isDuplicate } = await enqueue({
          assignmentId,
          personId: capturedApiPersonId,
          outcome: notHomeOutcome,
          supportLevel: null,
          wantsSign: false,
          isVolunteer: false,
          isDonorInterest: false,
          notes: capturedNotes,
          needsFollowUp: capturedFollowUp,
          competitorId: null,
          outcomeDetail: null,
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
        outcome: notHomeOutcome,
        supportLevel: null,
        signRequest: false,
        volunteerInterest: false,
        donorInterest: false,
        notes: capturedNotes,
        needsFollowUp: capturedFollowUp,
        competitorId: null,
        outcomeDetail: null,
        surveyId: null,
        surveyAnswers: null,
      });
      if (result.error) { setError(result.error); return; }
      markSavedAndAdvance(capturedEntryPersonId, capturedIndex);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, isPending, currentIndex, selectedPersonId, draft.notes, draft.needsFollowUp, assignmentId, markSavedAndAdvance, refreshSyncCount, preSavedIds]);

  // Derived state
  const isUndecided = draft.supportLevel === "undecided";
  const isNoLevel = draft.supportLevel === "soft_no" || draft.supportLevel === "strong_no";

  // Determine if Save & Continue is valid
  const canSave = (() => {
    if (isPending) return false;
    // If an other outcome is set (not-home sub-reason or refused or other_candidate), allow save
    if (draft.otherOutcome === "refused") return true;
    if (draft.otherOutcome === "other_candidate") return true;
    if (draft.otherOutcome && draft.otherOutcome !== "contacted") return true;
    // Spoke: need support level
    if (!draft.supportLevel) return false;
    // Level 3: need sub-detail
    if (draft.supportLevel === "undecided" && !draft.outcomeDetail) return false;
    // If survey exists and is required: survey must be complete
    if (activeSurvey) {
      const requiredQs = activeSurvey.questions.filter((q) => q.required);
      if (requiredQs.length > 0) {
        const allAnswered = requiredQs.every((q) => {
          const a = surveyAnswers[q.id];
          if (a === undefined || a === null || a === "") return false;
          if (Array.isArray(a)) return a.length > 0;
          return true;
        });
        if (!allAnswered) return false;
      }
    }
    return true;
  })();

  // Hint text for save button
  const saveHint = (() => {
    if (draft.otherOutcome === "refused") return null;
    if (draft.otherOutcome && draft.otherOutcome !== "contacted" && draft.otherOutcome !== "other_candidate") return null;
    if (!draft.supportLevel && !draft.otherOutcome) return "Select a support level";
    if (draft.supportLevel === "undecided" && !draft.outcomeDetail) return "Select a sub-option for level 3";
    if (activeSurvey) {
      const requiredQs = activeSurvey.questions.filter((q) => q.required);
      if (requiredQs.length > 0) {
        const allAnswered = requiredQs.every((q) => {
          const a = surveyAnswers[q.id];
          if (a === undefined || a === null || a === "") return false;
          if (Array.isArray(a)) return a.length > 0;
          return true;
        });
        if (!allAnswered) return "Complete the survey (tab 4) to save";
      }
    }
    return null;
  })();

  return {
    // Props pass-through
    ...props,

    // Core state
    entries,
    setEntries,
    currentIndex,
    setCurrentIndex,
    draft,
    setDraft,
    savedSet,
    setSavedSet,
    error,
    setError,
    isPending,
    done,
    setDone,

    // Session
    sessionStartTime,
    preSavedIds,
    sessionStats,

    // Person selection
    selectedPersonId,
    setSelectedPersonId,

    // Modals
    showVoterChangeModal,
    setShowVoterChangeModal,
    showAddResidentModal,
    setShowAddResidentModal,
    showEditConfirm,
    setShowEditConfirm,
    showAddResidentConfirm,
    setShowAddResidentConfirm,
    showSignatureModal,
    setShowSignatureModal,
    showParkedPanel,
    setShowParkedPanel,

    // Warnings
    outsideWardWarning,
    setOutsideWardWarning,
    swFailure,

    // Offline sync
    pendingCount,
    parkedCount,
    parkedItems,
    isSyncing,
    refreshSyncCount,
    retryParked,
    discardParked,

    // UI state
    showNotHomeMenu,
    setShowNotHomeMenu,
    surveyAnswers,
    setSurveyAnswers,
    saveFlash,

    // Sort & filter
    sortMode,
    setSortMode,
    parityFilter,
    setParityFilter,
    gpsPosition,
    setGpsPosition,
    gpsError,

    // Derived
    displayEntries,
    current,
    totalCount,
    doneCount,
    progressPct,
    isUndecided,
    isNoLevel,
    canSave,
    saveHint,

    // Actions
    handleSave,
    handleNotHomeSave,
    handleSkip,
    handlePrevious,
  };
}

export type CanvassState = ReturnType<typeof useCanvassState>;
