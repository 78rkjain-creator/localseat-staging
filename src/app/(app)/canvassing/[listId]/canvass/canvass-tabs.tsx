"use client";

import { useState } from "react";
import Link from "next/link";
import type { CanvassingQueue } from "@/lib/canvassing";
import type { FieldMessageItem } from "@/lib/field-messages";
import type { ActiveSurvey } from "@/lib/surveys";
import { FieldMessagesBanner } from "@/components/field-messages-banner";
import { DemoHint } from "@/components/demo/demo-hint";
import { useCanvassState } from "./use-canvass-state";
import type { QueuedResponse } from "@/lib/offline-queue";
import type { LocalEntry } from "./use-canvass-state";

// Tab components
import { TabLists } from "./tab-lists";
import { TabCanvass } from "./tab-canvass";
import { TabScript } from "./tab-script";
import { TabSurvey } from "./tab-survey";
import { TabSignature } from "./tab-signature";
import { TabMap } from "./tab-map";

// ── Types ──────────────────────────────────────────────────────────────────

type TabId = "lists" | "canvass" | "script" | "survey" | "sign" | "map";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  disabledWhen?: (state: ReturnType<typeof useCanvassState>) => boolean;
}

// ── Tab icons (inline SVGs) ────────────────────────────────────────────────

const IconLists = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const IconCanvass = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IconScript = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconSurvey = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const IconSign = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const IconMap = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);

const TABS: TabDef[] = [
  { id: "lists",   label: "Lists",   icon: IconLists },
  { id: "canvass", label: "Canvass", icon: IconCanvass },
  { id: "script",  label: "Script",  icon: IconScript,  disabledWhen: (s) => !s.canvassScript },
  { id: "survey",  label: "Survey",  icon: IconSurvey,  disabledWhen: (s) => !s.activeSurvey },
  { id: "sign",    label: "Sign",    icon: IconSign,    disabledWhen: (s) => s.consentTypes.length === 0 },
  { id: "map",     label: "Map",     icon: IconMap },
];

// ── Offline pill ──────────────────────────────────────────────────────────

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
      <div className="fixed bottom-20 left-4 z-10 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full">
        Offline · {pendingCount} queued
      </div>
    );
  }

  if (parkedCount > 0) {
    return (
      <button
        type="button"
        onClick={onOpenParked}
        className="fixed bottom-20 left-4 z-10 bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-3 py-1.5 rounded-full active:bg-red-100 transition-colors"
      >
        {parkedCount} failed · review
      </button>
    );
  }

  if (isSyncing) {
    return (
      <div className="fixed bottom-20 left-4 z-10 bg-white border border-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded-full">
        Syncing…
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="fixed bottom-20 left-4 z-10 bg-white border border-slate-200 text-slate-500 text-xs px-3 py-1.5 rounded-full">
        {pendingCount} to sync
      </div>
    );
  }

  return null;
}

// ── Parked panel ──────────────────────────────────────────────────────────

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
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[70vh] flex flex-col">
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
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {parkedItems.map((item) => (
            <li key={item.id} className="px-5 py-3.5">
              <p className="text-sm font-semibold text-slate-900 mb-0.5">{personName(item.personId)}</p>
              {item.lastError && <p className="text-xs text-red-600 mb-2">{item.lastError}</p>}
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

// ── Main shell component ──────────────────────────────────────────────────

interface CanvassScreenProps {
  listId: string;
  listName: string;
  assignmentId: string;
  campaignId: string;
  campaignCity?: string;
  canvassScript?: string | null;
  entries: CanvassingQueue["entries"];
  competitors: { id: string; name: string }[];
  appointmentsByPersonId?: Record<string, string>;
  fieldMessages?: FieldMessageItem[];
  activeSurvey?: ActiveSurvey | null;
  consentTypes?: { id: string; label: string }[];
  demoMode?: boolean;
  assignedLists?: { assignmentId: string; list: { id: string; name: string; description: string | null }; totalEntries: number; totalResponses: number }[];
}

export function CanvassScreen({
  listId,
  listName,
  assignmentId,
  campaignId,
  campaignCity = "",
  canvassScript = null,
  entries: initialEntries,
  competitors,
  appointmentsByPersonId = {},
  fieldMessages = [],
  activeSurvey = null,
  consentTypes = [],
  demoMode = false,
  assignedLists = [],
}: CanvassScreenProps) {
  const [activeTab, setActiveTab] = useState<TabId>("canvass");

  const state = useCanvassState({
    listId,
    listName,
    assignmentId,
    campaignId,
    campaignCity,
    canvassScript,
    entries: initialEntries,
    competitors,
    appointmentsByPersonId,
    activeSurvey,
    consentTypes,
    demoMode,
  });

  const {
    current,
    currentIndex,
    displayEntries,
    doneCount,
    totalCount,
    progressPct,
    swFailure,
    outsideWardWarning,
    setOutsideWardWarning,
    pendingCount,
    parkedCount,
    parkedItems,
    isSyncing,
    showParkedPanel,
    setShowParkedPanel,
    entries,
    retryParked,
    discardParked,
    done,
  } = state;

  function handleTabChange(tabId: TabId) {
    const tabDef = TABS.find((t) => t.id === tabId);
    if (!tabDef) return;
    if (tabDef.disabledWhen?.(state)) return;
    setActiveTab(tabId);
  }

  // Header subtitle
  const headerSubtitle =
    activeTab === "lists"
      ? "Your assigned walk lists"
      : current
        ? `Person ${currentIndex + 1} of ${displayEntries.length}`
        : "";

  return (
    <div className="h-screen [height:100dvh] bg-slate-50 flex flex-col overflow-hidden">

      <DemoHint
        demoMode={demoMode}
        storageKey="demo-hint-canvass-screen"
        hint="Tap a support level (1–5), toggle sign or volunteer interest, then hit Save & Continue. All responses are recorded to the campaign dashboard."
      />

      {/* Warning banners */}
      {swFailure && (
        <div className="flex-none bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <svg className="h-4 w-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-amber-800">Offline caching unavailable — stay connected to save responses.</p>
        </div>
      )}

      {outsideWardWarning && (
        <div className="flex-none bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <svg className="h-4 w-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-amber-800 flex-1">This address is outside your ward boundary. The record has been saved.</p>
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

      {fieldMessages.length > 0 && (
        <div className="flex-none px-3 pt-2">
          <FieldMessagesBanner messages={fieldMessages} />
        </div>
      )}

      {/* Header */}
      <header className="flex-none bg-slate-900 px-4 flex items-center gap-3 h-[52px]">
        <Link
          href="/canvassing"
          className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors flex-shrink-0"
          aria-label="Exit canvassing"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Link>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 truncate leading-none mb-0.5">{listName}</p>
          {activeTab !== "lists" && (
            <>
              <p className="text-[11px] text-slate-500 truncate leading-none mb-1">{headerSubtitle}</p>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </>
          )}
        </div>

        <span className="text-sm font-semibold text-slate-400 flex-shrink-0 tabular-nums">
          {doneCount}/{totalCount}
        </span>
      </header>

      {/* Tab bar */}
      <nav className="flex-none bg-slate-900 border-t border-slate-800 flex overflow-x-auto" role="tablist">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const isDisabled = tab.disabledWhen?.(state) ?? false;

          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-disabled={isDisabled}
              onClick={() => handleTabChange(tab.id)}
              disabled={isDisabled}
              className={[
                "flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2 px-1 text-center transition-all relative",
                isDisabled
                  ? "opacity-25 cursor-not-allowed"
                  : isActive
                    ? "text-brand-500"
                    : "text-slate-400 hover:text-slate-200 active:text-white",
              ].join(" ")}
            >
              {tab.icon}
              <span className="text-[9px] font-semibold uppercase tracking-wide leading-none truncate w-full">
                {tab.label}
              </span>
              {/* Active indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-brand-500 rounded-t-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === "lists" && (
          <TabLists
            state={state}
            assignedLists={assignedLists}
            currentListId={listId}
            onSelectList={() => setActiveTab("canvass")}
          />
        )}
        {activeTab === "canvass" && <TabCanvass state={state} />}
        {activeTab === "script" && <TabScript state={state} />}
        {activeTab === "survey" && <TabSurvey state={state} />}
        {activeTab === "sign" && <TabSignature state={state} />}
        {activeTab === "map" && <TabMap state={state} />}
      </div>

      {/* Offline sync pill */}
      <OfflinePill
        pendingCount={pendingCount}
        parkedCount={parkedCount}
        isSyncing={isSyncing}
        onOpenParked={() => setShowParkedPanel(true)}
      />

      {/* Parked items panel */}
      {showParkedPanel && (
        <ParkedPanel
          parkedItems={parkedItems}
          entries={entries}
          onRetry={async (id) => { await retryParked(id); }}
          onDiscard={async (id) => { await discardParked(id); }}
          onClose={() => setShowParkedPanel(false)}
        />
      )}
    </div>
  );
}
