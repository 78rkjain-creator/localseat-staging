"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleGotvMode, generateChaseList, generateKnockList } from "./actions";
import type { GotvStats, ChaseListPerson } from "@/lib/gotv";

interface RideRequest {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  votingPlanTime: string | null;
  address: string | null;
}

interface Props {
  stats: GotvStats;
  chaseList: ChaseListPerson[];
  chaseTotalCount: number;
  rideRequests: RideRequest[];
  isManager: boolean;
}

const PLAN_TIME_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export function GotvDashboard({
  stats,
  chaseList,
  chaseTotalCount,
  rideRequests,
  isManager,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [streetFilter, setStreetFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "chase" | "rides">("overview");

  const winPct =
    stats.voteTarget && stats.voteTarget > 0
      ? Math.min(100, Math.round((stats.alreadyVoted / stats.voteTarget) * 100))
      : null;

  function handleGenerateChaseList() {
    startTransition(async () => {
      const result = await generateChaseList();
      if (result.error) setFeedback(result.error);
      else setFeedback(`Chase list created with ${chaseTotalCount} people.`);
      setTimeout(() => setFeedback(null), 4000);
    });
  }

  function handleGenerateKnockList() {
    startTransition(async () => {
      const result = await generateKnockList(streetFilter || undefined);
      if (result.error) setFeedback(result.error);
      else setFeedback("Knock list created.");
      setTimeout(() => setFeedback(null), 4000);
    });
  }

  function handleDeactivate() {
    startTransition(async () => {
      await toggleGotvMode(false);
    });
  }

  const maxHourly = Math.max(...stats.hourlyStrikes.map((h) => h.count), 1);
  const currentHour = new Date().getHours();

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold bg-red-100 text-red-600 border border-red-200 animate-pulse">
              LIVE
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Election day</h1>
          </div>
          <p className="text-sm text-slate-500">
            {stats.totalSupporters} identified supporters · {stats.alreadyVoted} voted
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/gotv/strike"
            className="h-10 px-4 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Poll strike
          </Link>
        </div>
      </div>

      {feedback && (
        <div className="bg-brand-50 border border-brand-200 rounded-2xl px-4 py-3 mb-4">
          <p className="text-sm text-brand-700">{feedback}</p>
        </div>
      )}

      {/* Hero counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Voted"
          value={stats.alreadyVoted}
          accent="text-emerald-600"
          bg="bg-emerald-50 border-emerald-100"
        />
        <StatCard
          label="Remaining"
          value={stats.remaining}
          accent="text-amber-600"
          bg="bg-amber-50 border-amber-100"
        />
        {stats.gapToWin !== null && (
          <StatCard
            label="Gap to win"
            value={stats.gapToWin}
            accent={stats.gapToWin === 0 ? "text-emerald-600" : "text-red-500"}
            bg={stats.gapToWin === 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}
          />
        )}
        <StatCard
          label="Need rides"
          value={stats.needsRide}
          accent="text-blue-600"
          bg="bg-blue-50 border-blue-100"
        />
      </div>

      {/* Win number progress bar */}
      {stats.voteTarget && winPct !== null && (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">
              Progress to win number
            </p>
            <p className="text-sm tabular-nums text-slate-500">
              {stats.alreadyVoted.toLocaleString()} / {stats.voteTarget.toLocaleString()}
            </p>
          </div>
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={[
                "h-full rounded-full transition-all duration-500",
                winPct >= 100 ? "bg-emerald-500" : winPct >= 75 ? "bg-brand-500" : winPct >= 50 ? "bg-amber-400" : "bg-red-400",
              ].join(" ")}
              style={{ width: `${winPct}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            {winPct}% — {stats.gapToWin === 0
              ? "Target reached!"
              : `${stats.gapToWin?.toLocaleString()} more votes needed`}
          </p>
        </div>
      )}

      {/* Hourly progress */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 mb-6">
        <p className="text-sm font-semibold text-slate-700 mb-3">Hourly voting pace</p>
        <div className="flex items-end gap-1.5" style={{ height: 100 }}>
          {stats.hourlyStrikes.map((h) => {
            const barH = Math.max(4, Math.round((h.count / maxHourly) * 88));
            const isCurrent = h.hour === currentHour;
            const isPast = h.hour < currentHour;
            return (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                {h.count > 0 && (
                  <span className="text-[9px] text-slate-500 tabular-nums">{h.count}</span>
                )}
                <div
                  className={[
                    "w-full rounded-t transition-all",
                    isCurrent
                      ? "bg-brand-500"
                      : isPast
                        ? "bg-brand-300"
                        : "bg-slate-100",
                  ].join(" ")}
                  style={{ height: barH }}
                />
                <span className={[
                  "text-[9px] tabular-nums",
                  isCurrent ? "text-brand-600 font-semibold" : "text-slate-400",
                ].join(" ")}>
                  {h.hour > 12 ? `${h.hour - 12}p` : h.hour === 12 ? "12p" : `${h.hour}a`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vote type breakdown */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 text-center">
          <p className="text-xl font-bold text-slate-900 tabular-nums">{stats.electionDayVoted}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Election day</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 text-center">
          <p className="text-xl font-bold text-slate-900 tabular-nums">{stats.advanceVoted}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Advance poll</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 text-center">
          <p className="text-xl font-bold text-slate-900 tabular-nums">{stats.mailInVoted}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Mail-in</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-2xl p-1">
        {(
          [
            ["overview", "Actions"],
            ["chase", `Chase list (${chaseTotalCount})`],
            ["rides", `Rides (${rideRequests.length})`],
          ] as [typeof activeTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={[
              "flex-1 h-9 rounded-xl text-xs font-medium transition-all",
              activeTab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-3">
          {isManager && (
            <>
              <button
                type="button"
                onClick={handleGenerateChaseList}
                disabled={isPending}
                className="w-full h-12 bg-white border-2 border-brand-200 text-brand-600 hover:bg-brand-50 text-sm font-semibold rounded-2xl transition-colors disabled:opacity-50"
              >
                Generate chase list
              </button>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={streetFilter}
                  onChange={(e) => setStreetFilter(e.target.value)}
                  placeholder="Street name filter (optional)"
                  className="flex-1 h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={handleGenerateKnockList}
                  disabled={isPending}
                  className="h-11 px-4 bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold rounded-2xl transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  Knock list
                </button>
              </div>

              <hr className="border-slate-100 my-2" />

              <button
                type="button"
                onClick={handleDeactivate}
                disabled={isPending}
                className="w-full h-10 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 text-xs font-medium rounded-2xl transition-colors disabled:opacity-50"
              >
                Deactivate GOTV mode
              </button>
            </>
          )}

          {!isManager && (
            <Link
              href="/gotv/strike"
              className="w-full h-12 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Start poll striking
            </Link>
          )}
        </div>
      )}

      {activeTab === "chase" && (
        <div className="flex flex-col gap-2">
          {chaseList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 px-5 py-10 text-center">
              <p className="text-sm text-emerald-600 font-semibold">All supporters have voted!</p>
            </div>
          ) : (
            chaseList.map((person) => {
              const addr = person.address
                ? [person.address.unitNumber, person.address.streetNumber, person.address.streetName]
                    .filter(Boolean)
                    .join(" ")
                : null;
              return (
                <div
                  key={person.id}
                  className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {person.firstName} {person.lastName}
                    </p>
                    {addr && (
                      <p className="text-xs text-slate-500 truncate">{addr}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {person.votingPlanTime && (
                        <span className="text-[10px] text-slate-400">
                          Plans: {PLAN_TIME_LABELS[person.votingPlanTime] ?? person.votingPlanTime}
                        </span>
                      )}
                      {person.needsRide && (
                        <span className="text-[10px] text-blue-500 font-semibold">
                          Needs ride
                        </span>
                      )}
                    </div>
                  </div>
                  {(person.phoneMobile || person.phoneHome) && (
                    <a
                      href={`tel:${person.phoneMobile ?? person.phoneHome}`}
                      className="flex-shrink-0 h-10 w-10 rounded-2xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-500 hover:border-brand-200 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </a>
                  )}
                </div>
              );
            })
          )}
          {chaseTotalCount > chaseList.length && (
            <p className="text-xs text-slate-400 text-center py-2">
              Showing {chaseList.length} of {chaseTotalCount} remaining
            </p>
          )}
        </div>
      )}

      {activeTab === "rides" && (
        <div className="flex flex-col gap-2">
          {rideRequests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 px-5 py-10 text-center">
              <p className="text-sm text-slate-400">No ride requests.</p>
            </div>
          ) : (
            rideRequests.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3"
              >
                <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {r.firstName} {r.lastName}
                  </p>
                  {r.address && (
                    <p className="text-xs text-slate-500 truncate">{r.address}</p>
                  )}
                  {r.votingPlanTime && (
                    <p className="text-[10px] text-slate-400">
                      Preferred: {PLAN_TIME_LABELS[r.votingPlanTime] ?? r.votingPlanTime}
                    </p>
                  )}
                </div>
                {r.phone && (
                  <a
                    href={`tel:${r.phone}`}
                    className="flex-shrink-0 h-10 px-3 rounded-2xl border border-blue-200 bg-blue-50 text-blue-600 text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-100 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Call
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
  bg,
}: {
  label: string;
  value: number;
  accent: string;
  bg: string;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${bg}`}>
      <p className={`text-2xl font-bold tabular-nums ${accent}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mt-0.5">
        {label}
      </p>
    </div>
  );
}
