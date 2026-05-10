import { db } from "@/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  canvasserId: string;
  firstName: string;
  lastName: string;
  totalDoors: number;
  doorsToday: number;
  doorsThisWeek: number;
  signs: number;
  volunteers: number;
  currentStreak: number;
  longestStreak: number;
  bestDay: number;
  lastActive: string | null;
}

export interface Milestone {
  label: string;
  threshold: number;
  icon: string; // emoji
}

export const MILESTONES: Milestone[] = [
  { label: "First door", threshold: 1, icon: "🚪" },
  { label: "Getting started", threshold: 10, icon: "👟" },
  { label: "Finding your groove", threshold: 25, icon: "🎯" },
  { label: "Half century", threshold: 50, icon: "⭐" },
  { label: "Century club", threshold: 100, icon: "💯" },
  { label: "Neighbourhood hero", threshold: 200, icon: "🏅" },
  { label: "Door machine", threshold: 300, icon: "🔥" },
  { label: "Campaign legend", threshold: 500, icon: "🏆" },
  { label: "Thousand doors", threshold: 1000, icon: "👑" },
];

export function getEarnedMilestones(totalDoors: number): Milestone[] {
  return MILESTONES.filter((m) => totalDoors >= m.threshold);
}

export function getNextMilestone(totalDoors: number): Milestone | null {
  return MILESTONES.find((m) => totalDoors < m.threshold) ?? null;
}

// ── Streak calculation ────────────────────────────────────────────────────────
// A streak = consecutive calendar days with at least one canvass response.

function calculateStreaks(responseDates: Date[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (responseDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // Get unique dates (YYYY-MM-DD strings)
  const uniqueDays = new Set<string>();
  for (const d of responseDates) {
    uniqueDays.add(d.toISOString().split("T")[0]);
  }

  const sortedDays = Array.from(uniqueDays).sort();
  if (sortedDays.length === 0) return { currentStreak: 0, longestStreak: 0 };

  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / 86400000);

    if (diffDays === 1) {
      currentRun++;
    } else {
      currentRun = 1;
    }
    if (currentRun > longestStreak) longestStreak = currentRun;
  }

  // Current streak: count backwards from today
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Check if the last active day is today or yesterday (streak is still alive)
  const lastDay = sortedDays[sortedDays.length - 1];
  if (lastDay !== today && lastDay !== yesterday) {
    return { currentStreak: 0, longestStreak };
  }

  let currentStreak = 1;
  for (let i = sortedDays.length - 2; i >= 0; i--) {
    const curr = new Date(sortedDays[i + 1]);
    const prev = new Date(sortedDays[i]);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / 86400000);

    if (diffDays === 1) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
}

// ── Best day calculation ──────────────────────────────────────────────────────

function calculateBestDay(responseDates: Date[]): number {
  if (responseDates.length === 0) return 0;

  const dayCounts = new Map<string, number>();
  for (const d of responseDates) {
    const key = d.toISOString().split("T")[0];
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }

  let best = 0;
  for (const count of dayCounts.values()) {
    if (count > best) best = count;
  }
  return best;
}

// ── Full leaderboard ──────────────────────────────────────────────────────────

export async function getLeaderboard(campaignId: string): Promise<LeaderboardEntry[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday start

  const assignments = await db.canvassAssignment.findMany({
    where: { canvassList: { campaignId }, deletedAt: null },
    select: {
      canvasserId: true,
      canvasser: { select: { firstName: true, lastName: true } },
      responses: {
        select: {
          personId: true,
          signRequest: true,
          volunteerInterest: true,
          respondedAt: true,
        },
      },
    },
  });

  type Agg = {
    canvasserId: string;
    firstName: string;
    lastName: string;
    allPersonIds: Set<string>;
    todayPersonIds: Set<string>;
    weekPersonIds: Set<string>;
    signs: number;
    volunteers: number;
    lastActive: Date | null;
    responseDates: Date[];
  };

  const map = new Map<string, Agg>();

  for (const a of assignments) {
    let agg = map.get(a.canvasserId);
    if (!agg) {
      agg = {
        canvasserId: a.canvasserId,
        firstName: a.canvasser.firstName,
        lastName: a.canvasser.lastName,
        allPersonIds: new Set(),
        todayPersonIds: new Set(),
        weekPersonIds: new Set(),
        signs: 0,
        volunteers: 0,
        lastActive: null,
        responseDates: [],
      };
      map.set(a.canvasserId, agg);
    }
    for (const r of a.responses) {
      agg.allPersonIds.add(r.personId);
      if (r.respondedAt >= todayStart) agg.todayPersonIds.add(r.personId);
      if (r.respondedAt >= weekStart) agg.weekPersonIds.add(r.personId);
      if (r.signRequest) agg.signs++;
      if (r.volunteerInterest) agg.volunteers++;
      if (!agg.lastActive || r.respondedAt > agg.lastActive) agg.lastActive = r.respondedAt;
      agg.responseDates.push(r.respondedAt);
    }
  }

  return Array.from(map.values())
    .filter((c) => c.allPersonIds.size > 0)
    .map((c) => {
      const { currentStreak, longestStreak } = calculateStreaks(c.responseDates);
      const bestDay = calculateBestDay(c.responseDates);

      return {
        canvasserId: c.canvasserId,
        firstName: c.firstName,
        lastName: c.lastName,
        totalDoors: c.allPersonIds.size,
        doorsToday: c.todayPersonIds.size,
        doorsThisWeek: c.weekPersonIds.size,
        signs: c.signs,
        volunteers: c.volunteers,
        currentStreak,
        longestStreak,
        bestDay,
        lastActive: c.lastActive?.toISOString() ?? null,
      };
    })
    .sort((a, b) => b.totalDoors - a.totalDoors);
}

// ── Canvasser of the week ─────────────────────────────────────────────────────

export function getCanvasserOfTheWeek(
  leaderboard: LeaderboardEntry[]
): LeaderboardEntry | null {
  if (leaderboard.length === 0) return null;

  // Highest doors this week wins
  const sorted = [...leaderboard].sort((a, b) => b.doorsThisWeek - a.doorsThisWeek);
  return sorted[0].doorsThisWeek > 0 ? sorted[0] : null;
}

// ── Personal stats for a single canvasser ─────────────────────────────────────

export async function getMyEngagementStats(
  userId: string,
  campaignId: string
): Promise<{
  totalDoors: number;
  doorsToday: number;
  currentStreak: number;
  longestStreak: number;
  bestDay: number;
  earnedMilestones: Milestone[];
  nextMilestone: Milestone | null;
  rank: number;
  totalCanvassers: number;
}> {
  const leaderboard = await getLeaderboard(campaignId);
  const me = leaderboard.find((e) => e.canvasserId === userId);

  if (!me) {
    return {
      totalDoors: 0,
      doorsToday: 0,
      currentStreak: 0,
      longestStreak: 0,
      bestDay: 0,
      earnedMilestones: [],
      nextMilestone: MILESTONES[0],
      rank: 0,
      totalCanvassers: leaderboard.length,
    };
  }

  const rank = leaderboard.findIndex((e) => e.canvasserId === userId) + 1;

  return {
    totalDoors: me.totalDoors,
    doorsToday: me.doorsToday,
    currentStreak: me.currentStreak,
    longestStreak: me.longestStreak,
    bestDay: me.bestDay,
    earnedMilestones: getEarnedMilestones(me.totalDoors),
    nextMilestone: getNextMilestone(me.totalDoors),
    rank,
    totalCanvassers: leaderboard.length,
  };
}
