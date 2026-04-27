import { db } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SupportTrendPoint {
  date: string;
  strong_yes: number;
  soft_yes: number;
  undecided: number;
  soft_no: number;
  strong_no: number;
}

export interface DoorsPerDayPoint {
  date: string;
  doors: number;
}

export interface CanvasserPerfPoint {
  name: string;
  doors: number;
}

export interface DistributionPoint {
  level: string;
  label: string;
  count: number;
}

export interface AnalyticsData {
  supportTrend: SupportTrendPoint[];
  doorsPerDay: DoorsPerDayPoint[];
  canvasserPerf: CanvasserPerfPoint[];
  distribution: DistributionPoint[];
  totalResponses: number;
  totalCanvassedPeople: number;
}

const SUPPORT_LABELS: Record<string, string> = {
  strong_yes: "Strong Yes",
  soft_yes: "Soft Yes",
  undecided: "Undecided",
  soft_no: "Soft No",
  strong_no: "Strong No",
};

const SUPPORT_LEVELS = ["strong_yes", "soft_yes", "undecided", "soft_no", "strong_no"] as const;

// ── Main analytics query ───────────────────────────────────────────────────

export async function getAnalyticsData(campaignId: string): Promise<AnalyticsData> {
  // Fetch all canvass responses for this campaign in one query.
  // Join through person.campaignId since canvassResponse has no direct campaignId.
  const responses = await db.canvassResponse.findMany({
    where: {
      person: { campaignId },
    },
    select: {
      personId: true,
      outcome: true,
      supportLevel: true,
      respondedAt: true,
      assignment: {
        select: {
          canvasserId: true,
          canvasser: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { respondedAt: "asc" },
  });

  // ── Chart 1: Support level trend by day ───────────────────────────────────

  const trendMap = new Map<string, Record<string, number>>();

  for (const r of responses) {
    if (!r.supportLevel) continue;
    const date = r.respondedAt.toISOString().slice(0, 10);
    if (!trendMap.has(date)) trendMap.set(date, {});
    const day = trendMap.get(date)!;
    day[r.supportLevel] = (day[r.supportLevel] ?? 0) + 1;
  }

  const supportTrend: SupportTrendPoint[] = [...trendMap.entries()].map(
    ([date, counts]) => ({
      date,
      strong_yes: counts.strong_yes ?? 0,
      soft_yes: counts.soft_yes ?? 0,
      undecided: counts.undecided ?? 0,
      soft_no: counts.soft_no ?? 0,
      strong_no: counts.strong_no ?? 0,
    })
  );

  // ── Chart 2: Distinct persons canvassed per day ───────────────────────────

  const doorsByDate = new Map<string, Set<string>>();

  for (const r of responses) {
    const date = r.respondedAt.toISOString().slice(0, 10);
    if (!doorsByDate.has(date)) doorsByDate.set(date, new Set());
    doorsByDate.get(date)!.add(r.personId);
  }

  const doorsPerDay: DoorsPerDayPoint[] = [...doorsByDate.entries()].map(
    ([date, persons]) => ({ date, doors: persons.size })
  );

  // ── Chart 3: Canvasser performance (distinct persons knocked) ─────────────

  const canvasserMap = new Map<string, { name: string; doors: Set<string> }>();

  for (const r of responses) {
    const { canvasserId, canvasser } = r.assignment;
    if (!canvasserMap.has(canvasserId)) {
      canvasserMap.set(canvasserId, {
        name: `${canvasser.firstName} ${canvasser.lastName}`,
        doors: new Set(),
      });
    }
    canvasserMap.get(canvasserId)!.doors.add(r.personId);
  }

  const canvasserPerf: CanvasserPerfPoint[] = [...canvasserMap.values()]
    .map(({ name, doors }) => ({ name, doors: doors.size }))
    .sort((a, b) => b.doors - a.doors);

  // ── Chart 4: Current support level distribution ───────────────────────────
  // Most recent support-level response per person (responses sorted asc → later overwrites)

  const latestSupportByPerson = new Map<string, string>();
  for (const r of responses) {
    if (r.supportLevel) {
      latestSupportByPerson.set(r.personId, r.supportLevel);
    }
  }

  const distCounts: Record<string, number> = {};
  for (const level of latestSupportByPerson.values()) {
    distCounts[level] = (distCounts[level] ?? 0) + 1;
  }

  const distribution: DistributionPoint[] = SUPPORT_LEVELS
    .filter((l) => distCounts[l] !== undefined)
    .map((l) => ({
      level: l,
      label: SUPPORT_LABELS[l] ?? l,
      count: distCounts[l] ?? 0,
    }));

  return {
    supportTrend,
    doorsPerDay,
    canvasserPerf,
    distribution,
    totalResponses: responses.length,
    totalCanvassedPeople: new Set(responses.map((r) => r.personId)).size,
  };
}
