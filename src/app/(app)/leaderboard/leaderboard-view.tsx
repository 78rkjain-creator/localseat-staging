"use client";

import { useState } from "react";
import type { LeaderboardEntry, Milestone } from "@/lib/engagement";

interface MyStats {
  totalDoors: number;
  doorsToday: number;
  currentStreak: number;
  longestStreak: number;
  bestDay: number;
  earnedMilestones: Milestone[];
  nextMilestone: Milestone | null;
  rank: number;
  totalCanvassers: number;
}

interface Props {
  leaderboard: LeaderboardEntry[];
  canvasserOfTheWeek: LeaderboardEntry | null;
  myStats: MyStats;
  myUserId: string;
}

export function LeaderboardView({
  leaderboard,
  canvasserOfTheWeek,
  myStats,
  myUserId,
}: Props) {
  const [tab, setTab] = useState<"board" | "me">("board");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div
        className="px-4 pt-5 pb-5"
        style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
      >
        <h1 className="text-xl font-bold text-white mb-1">Leaderboard</h1>
        <p className="text-sm text-white/60">Campaign canvassing stats</p>

        {/* Canvasser of the week */}
        {canvasserOfTheWeek && (
          <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.15)" }}>
            <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-1">
              🏆 Canvasser of the week
            </p>
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
              >
                {canvasserOfTheWeek.firstName[0]}
                {canvasserOfTheWeek.lastName[0]}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  {canvasserOfTheWeek.firstName} {canvasserOfTheWeek.lastName}
                </p>
                <p className="text-white/60 text-xs">
                  {canvasserOfTheWeek.doorsThisWeek} doors this week
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="px-4 pt-3">
        <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
          {(
            [
              ["board", "Leaderboard"],
              ["me", "My stats"],
            ] as [typeof tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                "flex-1 h-9 rounded-xl text-xs font-medium transition-all",
                tab === key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {tab === "board" && (
          <div className="flex flex-col gap-2">
            {leaderboard.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 px-5 py-10 text-center">
                <p className="text-sm text-slate-400">No canvassing activity yet.</p>
              </div>
            ) : (
              leaderboard.map((entry, i) => {
                const isMe = entry.canvasserId === myUserId;
                const rankBg =
                  i === 0
                    ? "bg-amber-50 border-amber-200"
                    : i === 1
                      ? "bg-slate-50 border-slate-200"
                      : i === 2
                        ? "bg-orange-50/50 border-orange-200"
                        : "bg-white border-slate-200";
                const rankIcon = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

                return (
                  <div
                    key={entry.canvasserId}
                    className={[
                      "rounded-2xl border px-4 py-3 flex items-center gap-3",
                      rankBg,
                      isMe ? "ring-2 ring-violet-300" : "",
                    ].join(" ")}
                  >
                    <span className="text-sm font-bold text-slate-400 w-6 text-center flex-shrink-0">
                      {rankIcon ?? i + 1}
                    </span>
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{
                        background: isMe
                          ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                          : "linear-gradient(135deg, #f97316, #ea580c)",
                      }}
                    >
                      {entry.firstName[0]}
                      {entry.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {entry.firstName} {entry.lastName}
                        {isMe && (
                          <span className="text-violet-500 text-xs font-normal ml-1">
                            (you)
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {entry.currentStreak > 1 && (
                          <span className="text-[10px] text-amber-600">
                            🔥 {entry.currentStreak}d streak
                          </span>
                        )}
                        {entry.doorsToday > 0 && (
                          <span className="text-[10px] text-slate-400">
                            {entry.doorsToday} today
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-slate-900 tabular-nums">
                        {entry.totalDoors}
                      </p>
                      <p className="text-[10px] text-slate-400">doors</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "me" && (
          <div className="flex flex-col gap-4">
            {/* Rank + total */}
            <div className="bg-white rounded-2xl border border-slate-200 px-5 py-5 text-center">
              {myStats.rank > 0 ? (
                <>
                  <p className="text-4xl font-bold text-violet-600 tabular-nums">
                    #{myStats.rank}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    of {myStats.totalCanvassers} canvassers
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  Start canvassing to appear on the leaderboard.
                </p>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total doors" value={myStats.totalDoors} />
              <StatCard label="Today" value={myStats.doorsToday} />
              <StatCard
                label="Current streak"
                value={myStats.currentStreak > 0 ? `${myStats.currentStreak}d` : "—"}
                accent={myStats.currentStreak > 2}
              />
              <StatCard
                label="Longest streak"
                value={myStats.longestStreak > 0 ? `${myStats.longestStreak}d` : "—"}
              />
              <StatCard
                label="Best day"
                value={myStats.bestDay > 0 ? myStats.bestDay : "—"}
              />
              <StatCard
                label="Rank"
                value={myStats.rank > 0 ? `#${myStats.rank}` : "—"}
              />
            </div>

            {/* Milestones */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Milestones
              </p>
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                {myStats.earnedMilestones.length === 0 && !myStats.nextMilestone ? (
                  <div className="px-5 py-4 text-center">
                    <p className="text-sm text-slate-400">Start canvassing to earn milestones.</p>
                  </div>
                ) : (
                  <>
                    {myStats.earnedMilestones.map((m) => (
                      <div key={m.threshold} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-lg">{m.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">{m.label}</p>
                          <p className="text-[10px] text-slate-400">{m.threshold} doors</p>
                        </div>
                        <svg
                          className="h-4 w-4 text-emerald-500 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    ))}
                    {myStats.nextMilestone && (
                      <div className="flex items-center gap-3 px-4 py-3 opacity-50">
                        <span className="text-lg">{myStats.nextMilestone.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-700">
                            {myStats.nextMilestone.label}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {myStats.nextMilestone.threshold - myStats.totalDoors} more doors
                          </p>
                        </div>
                        <div className="h-4 w-4 rounded-full border-2 border-slate-200 flex-shrink-0" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 text-center">
      <p
        className={[
          "text-2xl font-bold tabular-nums",
          accent ? "text-amber-500" : "text-slate-900",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mt-0.5">
        {label}
      </p>
    </div>
  );
}
