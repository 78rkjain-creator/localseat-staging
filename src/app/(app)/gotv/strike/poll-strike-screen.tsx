"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { strikePerson, unstrikePerson } from "../actions";
import type { PollStrikeType } from "@prisma/client";

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  supportLevel: string | null;
  address: string | null;
  hasVoted: boolean;
  strikeType: string | null;
  struckAt: string | null;
}

const SUPPORT_LABELS: Record<string, string> = {
  strong_yes: "Strong",
  soft_yes: "Leaning",
  undecided: "Undecided",
  soft_no: "Unlikely",
  strong_no: "Against",
};

const SUPPORT_COLORS: Record<string, string> = {
  strong_yes: "bg-emerald-100 text-emerald-700 border-emerald-200",
  soft_yes: "bg-emerald-50 text-emerald-600 border-emerald-100",
  undecided: "bg-amber-50 text-amber-600 border-amber-100",
  soft_no: "bg-red-50 text-red-500 border-red-100",
  strong_no: "bg-red-100 text-red-600 border-red-200",
};

export function PollStrikeScreen({ campaignId }: { campaignId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ id: string; action: "struck" | "undone" } | null>(null);
  const [strikeType, setStrikeType] = useState<PollStrikeType>("election_day");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-focus search on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/gotv/search?q=${encodeURIComponent(query.trim())}&campaignId=${campaignId}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } catch {
        // silently fail — user can retry
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, campaignId]);

  function handleStrike(personId: string) {
    startTransition(async () => {
      const result = await strikePerson(personId, strikeType);
      if (!result.error) {
        setFeedback({ id: personId, action: "struck" });
        setResults((prev) =>
          prev.map((r) =>
            r.id === personId
              ? { ...r, hasVoted: true, strikeType, struckAt: new Date().toISOString() }
              : r
          )
        );
        setTimeout(() => setFeedback(null), 2000);
      }
    });
  }

  function handleUndo(personId: string) {
    startTransition(async () => {
      const result = await unstrikePerson(personId);
      if (!result.error) {
        setFeedback({ id: personId, action: "undone" });
        setResults((prev) =>
          prev.map((r) =>
            r.id === personId
              ? { ...r, hasVoted: false, strikeType: null, struckAt: null }
              : r
          )
        );
        setTimeout(() => setFeedback(null), 2000);
      }
    });
  }

  const votedCount = results.filter((r) => r.hasVoted).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-slate-900">Poll strike</h1>
          <a
            href="/gotv"
            className="text-sm text-brand-500 hover:text-brand-600 font-medium"
          >
            Dashboard
          </a>
        </div>

        {/* Strike type selector */}
        <div className="flex gap-1.5 mb-3">
          {(
            [
              ["election_day", "Election day"],
              ["advance_poll", "Advance poll"],
              ["mail_in", "Mail-in"],
            ] as [PollStrikeType, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStrikeType(value)}
              className={[
                "flex-1 h-9 rounded-xl text-xs font-medium transition-all border-2",
                strikeType === value
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-500",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            autoComplete="off"
            className="w-full h-12 pl-10 pr-4 rounded-2xl border border-slate-200 bg-slate-50 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full bg-slate-200 text-slate-500"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {searching && results.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Searching…</p>
        )}

        {!searching && query.trim() && results.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No results found.</p>
        )}

        {!query.trim() && (
          <div className="text-center py-12">
            <svg className="h-12 w-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-sm text-slate-400">Search for a voter to mark them as voted.</p>
          </div>
        )}

        {results.length > 0 && (
          <>
            {votedCount > 0 && (
              <p className="text-xs text-slate-400 mb-2">
                {votedCount} of {results.length} shown have voted
              </p>
            )}
            <div className="flex flex-col gap-2">
              {results.map((person) => {
                const isFeedback = feedback?.id === person.id;
                return (
                  <div
                    key={person.id}
                    className={[
                      "bg-white rounded-2xl border px-4 py-3 transition-all",
                      person.hasVoted
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-slate-200",
                      isFeedback ? "ring-2 ring-brand-300" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      {/* Person info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">
                            {person.firstName} {person.lastName}
                          </p>
                          {person.supportLevel && (
                            <span
                              className={[
                                "inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold border",
                                SUPPORT_COLORS[person.supportLevel] ?? "bg-slate-100 text-slate-500 border-slate-200",
                              ].join(" ")}
                            >
                              {SUPPORT_LABELS[person.supportLevel] ?? person.supportLevel}
                            </span>
                          )}
                        </div>
                        {person.address && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {person.address}
                          </p>
                        )}
                        {person.hasVoted && person.struckAt && (
                          <p className="text-[10px] text-emerald-600 mt-0.5">
                            Voted{" "}
                            {new Date(person.struckAt).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>

                      {/* Strike / undo button */}
                      {person.hasVoted ? (
                        <button
                          type="button"
                          onClick={() => handleUndo(person.id)}
                          disabled={isPending}
                          className="flex-shrink-0 h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center disabled:opacity-50"
                        >
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStrike(person.id)}
                          disabled={isPending}
                          className="flex-shrink-0 h-12 px-4 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                          Voted
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
