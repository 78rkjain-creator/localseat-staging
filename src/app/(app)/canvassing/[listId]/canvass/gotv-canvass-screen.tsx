"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { strikePerson } from "@/app/(app)/gotv/actions";

interface Entry {
  person: {
    id: string;
    firstName: string;
    lastName: string;
    phoneHome: string | null;
    phoneMobile: string | null;
    household: {
      address: {
        streetNumber: string | null;
        streetName: string | null;
        unitNumber: string | null;
      } | null;
    } | null;
    canvassResponses: { id: string }[];
  };
}

interface Props {
  listId: string;
  listName: string;
  assignmentId: string;
  campaignId: string;
  entries: Entry[];
}

export function GotvCanvassScreen({ listId, listName, entries, campaignId }: Props) {
  // Filter to people who haven't been canvassed yet on this assignment
  const remaining = entries.filter((e) => e.person.canvassResponses.length === 0);
  const done = entries.length - remaining.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  const activePeople = remaining.filter((e) => !markedIds.has(e.person.id));
  const current = activePeople[currentIndex] ?? null;
  const totalDone = done + markedIds.size;
  const totalRemaining = entries.length - totalDone;
  const pct = entries.length > 0 ? Math.round((totalDone / entries.length) * 100) : 0;

  function handleVoted() {
    if (!current) return;
    const personId = current.person.id;
    startTransition(async () => {
      const result = await strikePerson(personId, "election_day");
      if (!result.error) {
        setMarkedIds((prev) => new Set(prev).add(personId));
        setFeedback("Voted ✓");
        setTimeout(() => setFeedback(null), 1500);
      }
    });
  }

  function handleNeedsRide() {
    if (!current) return;
    const personId = current.person.id;
    startTransition(async () => {
      // Record as voted + flag the ride need
      await fetch("/api/gotv/ride", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, campaignId }),
      });
      const result = await strikePerson(personId, "election_day", "Needs a ride to polls");
      if (!result.error) {
        setMarkedIds((prev) => new Set(prev).add(personId));
        setFeedback("Ride flagged ✓");
        setTimeout(() => setFeedback(null), 1500);
      }
    });
  }

  function handleNotHome() {
    if (!current) return;
    setMarkedIds((prev) => new Set(prev).add(current.person.id));
  }

  function handleSkip() {
    if (currentIndex < activePeople.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  const addr = current?.person.household?.address;
  const addrStr = addr
    ? [addr.unitNumber, addr.streetNumber, addr.streetName].filter(Boolean).join(" ")
    : null;
  const phone = current?.person.phoneMobile ?? current?.person.phoneHome ?? null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-emerald-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <a href="/dashboard" className="text-emerald-200 hover:text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <div>
              <p className="text-white text-sm font-semibold truncate">{listName}</p>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                <p className="text-emerald-200 text-[10px] font-semibold uppercase tracking-wider">GOTV</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-sm font-bold tabular-nums">{totalDone}/{entries.length}</p>
            <p className="text-emerald-200 text-[10px]">{pct}% done</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-emerald-900/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-300 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className="mx-4 mt-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5 text-center">
          <p className="text-sm font-semibold text-emerald-700">{feedback}</p>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col px-4 py-4">
        {!current ? (
          /* All done */
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-bold text-slate-900">List complete</p>
            <p className="text-sm text-slate-500 mt-1">
              {totalDone} of {entries.length} doors covered.
            </p>
            <a
              href="/dashboard"
              className="mt-6 h-12 px-6 bg-emerald-600 text-white text-sm font-semibold rounded-2xl flex items-center justify-center hover:bg-emerald-700 transition-colors"
            >
              Back to dashboard
            </a>
          </div>
        ) : (
          <>
            {/* Person card */}
            <div className="bg-white rounded-2xl border border-slate-200 px-5 py-5 mb-4">
              <p className="text-xs text-slate-400 mb-1">
                {currentIndex + 1} of {activePeople.length} remaining
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {current.person.firstName} {current.person.lastName}
              </p>
              {addrStr && (
                <p className="text-sm text-slate-500 mt-1">{addrStr}</p>
              )}
              {phone && (
                <a href={`tel:${phone}`} className="text-sm text-brand-500 hover:text-brand-600 mt-1 inline-block">
                  {phone}
                </a>
              )}
            </div>

            {/* Two main action buttons */}
            <div className="flex flex-col gap-3 mb-4">
              <button
                type="button"
                onClick={handleVoted}
                disabled={isPending}
                className="h-16 w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-lg font-bold rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Voted
              </button>
              <button
                type="button"
                onClick={handleNeedsRide}
                disabled={isPending}
                className="h-16 w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-lg font-bold rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Needs a ride
              </button>
            </div>

            {/* Secondary actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleNotHome}
                disabled={isPending}
                className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-2xl transition-colors"
              >
                Not home
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={isPending || currentIndex >= activePeople.length - 1}
                className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-2xl transition-colors disabled:opacity-50"
              >
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
