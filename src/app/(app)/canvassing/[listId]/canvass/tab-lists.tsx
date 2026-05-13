"use client";

import Link from "next/link";
import type { CanvassState } from "./use-canvass-state";

interface AssignedList {
  assignmentId: string;
  list: { id: string; name: string; description: string | null };
  totalEntries: number;
  totalResponses: number;
}

interface TabListsProps {
  state: CanvassState;
  assignedLists: AssignedList[];
  currentListId: string;
  onSelectList: () => void;
}

export function TabLists({ state, assignedLists, currentListId, onSelectList }: TabListsProps) {
  if (assignedLists.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-4 mx-auto">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-700 mb-1">No lists assigned yet</p>
          <p className="text-sm text-slate-400">Your organizer will assign you a walk list when you're ready to start canvassing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="max-w-lg mx-auto flex flex-col gap-3">
        {assignedLists.map((a) => {
          const isCurrent = a.list.id === currentListId;
          const pct = a.totalEntries > 0
            ? Math.min(100, Math.round((a.totalResponses / a.totalEntries) * 100))
            : 0;
          const remaining = Math.max(0, a.totalEntries - a.totalResponses);

          if (isCurrent) {
            // Current list — tap to switch to canvass tab
            return (
              <button
                key={a.assignmentId}
                type="button"
                onClick={onSelectList}
                className="w-full text-left bg-white rounded-2xl border-2 border-brand-400 shadow-sm overflow-hidden active:bg-slate-50 transition-colors"
              >
                <ListCardContent
                  name={a.list.name}
                  description={a.list.description}
                  pct={pct}
                  totalEntries={a.totalEntries}
                  totalResponses={a.totalResponses}
                  remaining={remaining}
                  isCurrent
                />
              </button>
            );
          }

          // Other lists — navigate to their canvass page
          return (
            <Link
              key={a.assignmentId}
              href={`/canvassing/${a.list.id}/canvass`}
              className="block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 active:bg-slate-50 transition-colors"
            >
              <ListCardContent
                name={a.list.name}
                description={a.list.description}
                pct={pct}
                totalEntries={a.totalEntries}
                totalResponses={a.totalResponses}
                remaining={remaining}
                isCurrent={false}
              />
            </Link>
          );
        })}

        {/* Street Walk link */}
        <Link
          href="/canvassing/street-walk"
          className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3.5 hover:border-amber-200 hover:bg-amber-50/40 active:bg-amber-50 transition-colors"
        >
          <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm">Street Walk</p>
            <p className="text-xs text-slate-500">Canvass without a walk list</p>
          </div>
          <svg className="h-4 w-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ── Shared card content ────────────────────────────────────────────────────

function ListCardContent({
  name,
  description,
  pct,
  totalEntries,
  totalResponses,
  remaining,
  isCurrent,
}: {
  name: string;
  description: string | null;
  pct: number;
  totalEntries: number;
  totalResponses: number;
  remaining: number;
  isCurrent: boolean;
}) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-base font-bold text-slate-900 truncate">{name}</h3>
            {isCurrent && (
              <span className="text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-2 py-0.5 flex-shrink-0 uppercase tracking-wide">
                Active
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-slate-500 truncate">{description}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right ml-3">
          <p className="text-lg font-bold text-slate-900">{pct}%</p>
          <p className="text-[10px] text-slate-400">done</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isCurrent ? "bg-brand-500" : "bg-slate-800"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-slate-400">
          <span>{totalResponses} recorded</span>
          <span>{remaining} remaining</span>
        </div>
      </div>

      {/* Action hint */}
      <div className="mt-3 flex items-center justify-center gap-2 h-11 rounded-2xl bg-slate-50 text-sm font-semibold text-slate-600">
        {isCurrent
          ? remaining > 0
            ? totalResponses === 0 ? "Start canvassing →" : "Continue canvassing →"
            : "Review list →"
          : remaining > 0
            ? "Switch to this list →"
            : "Review list →"}
      </div>
    </div>
  );
}
