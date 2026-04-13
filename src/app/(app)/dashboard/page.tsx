import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole, firstName } = session.user;

  if (!activeCampaignId) {
    redirect("/select-campaign");
  }

  // ── Base counts ────────────────────────────────────────────────────────────
  const [peopleCount, tasksCount, canvassListCount, pendingFollowUps] =
    await Promise.all([
      db.person.count({ where: { campaignId: activeCampaignId, deletedAt: null } }),
      db.task.count({ where: { campaignId: activeCampaignId, completed: false } }),
      db.canvassList.count({ where: { campaignId: activeCampaignId, deletedAt: null } }),
      db.task.count({
        where: { campaignId: activeCampaignId, completed: false, dueDate: { lte: new Date() } },
      }),
    ]);

  // ── ID breakdown ───────────────────────────────────────────────────────────
  // For each person, find their most recent canvass response support level.
  // We do this by fetching the latest respondedAt per person, then grouping.
  //
  // Prisma doesn't support "latest per group" natively, so we:
  //   1. Fetch all people IDs in the campaign
  //   2. For each person who has at least one response, get their latest supportLevel
  //   3. Bucket into: for_us, against_us, undecided, not_home, uncontacted

  const [allPeople, latestResponses] = await Promise.all([
    db.person.findMany({
      where: { campaignId: activeCampaignId, deletedAt: null },
      select: { id: true },
    }),
    // Subquery equivalent: for each person, the single most-recent response
    db.canvassResponse.findMany({
      where: {
        person: { campaignId: activeCampaignId, deletedAt: null },
      },
      orderBy: { respondedAt: "desc" },
      distinct: ["personId"],
      select: { personId: true, supportLevel: true },
    }),
  ]);

  const total = allPeople.length;

  // Map personId → latest supportLevel (null means response exists but no level recorded)
  const latestByPerson = new Map(
    latestResponses.map((r) => [r.personId, r.supportLevel])
  );

  let forUs      = 0; // strong_yes + soft_yes
  let againstUs  = 0; // strong_no + soft_no
  let undecided  = 0;
  let notHome    = 0; // not_home support level recorded
  let uncontacted = 0; // no response at all

  for (const { id } of allPeople) {
    if (!latestByPerson.has(id)) {
      uncontacted++;
      continue;
    }
    const level = latestByPerson.get(id);
    if (level === "strong_yes" || level === "soft_yes") forUs++;
    else if (level === "strong_no" || level === "soft_no") againstUs++;
    else if (level === "undecided") undecided++;
    else notHome++; // not_home level, or null (contacted but no level given)
  }

  // Support rate: for_us ÷ all genuinely ID'd (excludes not_home + uncontacted)
  const idd = forUs + againstUs + undecided;
  const supportRate = idd > 0 ? Math.round((forUs / idd) * 100) : null;

  function pct(n: number) {
    if (total === 0) return "—";
    return `${Math.round((n / total) * 100)}%`;
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Good to see you, {firstName}
        </h1>
        {activeRole && (
          <p className="text-slate-500 mt-1">{ROLE_LABELS[activeRole]}</p>
        )}
      </div>

      {/* Operational counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="People" value={peopleCount} />
        <MetricCard label="Walk lists" value={canvassListCount} />
        <MetricCard label="Open tasks" value={tasksCount} />
        <MetricCard label="Overdue" value={pendingFollowUps} highlight={pendingFollowUps > 0} />
      </div>

      {/* ID breakdown */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Voter ID breakdown
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <IdCard
          label="For us"
          sublabel="Strong Yes + Soft Yes"
          value={forUs}
          pctOfTotal={pct(forUs)}
          color="emerald"
        />
        <IdCard
          label="Against us"
          sublabel="Strong No + Soft No"
          value={againstUs}
          pctOfTotal={pct(againstUs)}
          color="red"
        />
        <IdCard
          label="Undecided"
          sublabel="Persuadable voters"
          value={undecided}
          pctOfTotal={pct(undecided)}
          color="amber"
        />
        <IdCard
          label="Not yet contacted"
          sublabel="No canvass response on record"
          value={uncontacted}
          pctOfTotal={pct(uncontacted)}
          color="slate"
        />
        <IdCard
          label="Not home / no level"
          sublabel="Contacted but no ID recorded"
          value={notHome}
          pctOfTotal={pct(notHome)}
          color="slate"
        />
        {supportRate !== null && (
          <Card padding="md" className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Support rate
              </p>
              <p className="text-xs text-slate-400 mb-3">
                Of all ID&apos;d voters
              </p>
            </div>
            <p className="text-3xl font-bold text-brand-500">
              {supportRate}%
            </p>
          </Card>
        )}
      </div>

      {/* Progress bar — for us vs against vs undecided */}
      {idd > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1.5 text-xs text-slate-500">
            <span>For us ({Math.round((forUs / idd) * 100)}%)</span>
            <span>Against ({Math.round((againstUs / idd) * 100)}%)</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${(forUs / idd) * 100}%` }}
            />
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${(undecided / idd) * 100}%` }}
            />
            <div
              className="h-full bg-red-400 transition-all"
              style={{ width: `${(againstUs / idd) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5 text-center">
            Based on {idd.toLocaleString()} ID&apos;d voter{idd !== 1 ? "s" : ""}
            {" "}(excludes not home and uncontacted)
          </p>
        </div>
      )}

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-base font-semibold text-slate-900 mb-1">
            Recent activity
          </h2>
          <p className="text-sm text-slate-400">Coming soon — outreach and canvass activity feed.</p>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-slate-900 mb-1">
            Follow-up queue
          </h2>
          <p className="text-sm text-slate-400">Coming soon — tasks due today and overdue items.</p>
        </Card>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card padding="md">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={["text-3xl font-bold", highlight ? "text-brand-500" : "text-slate-900"].join(" ")}>
        {value.toLocaleString()}
      </p>
    </Card>
  );
}

type IdCardColor = "emerald" | "red" | "amber" | "slate";

const idCardAccent: Record<IdCardColor, string> = {
  emerald: "text-emerald-600",
  red:     "text-red-600",
  amber:   "text-amber-600",
  slate:   "text-slate-700",
};

function IdCard({
  label,
  sublabel,
  value,
  pctOfTotal,
  color,
}: {
  label: string;
  sublabel: string;
  value: number;
  pctOfTotal: string;
  color: IdCardColor;
}) {
  return (
    <Card padding="md" className="flex flex-col justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <p className="text-xs text-slate-400 mb-3">{sublabel}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className={["text-3xl font-bold", idCardAccent[color]].join(" ")}>
          {value.toLocaleString()}
        </p>
        <p className="text-sm font-medium text-slate-400 mb-0.5">{pctOfTotal}</p>
      </div>
    </Card>
  );
}
