import Link from "next/link";
import { db } from "@/lib/db";
import {
  getDashboardHeroData,
  getCandidateDashboardData,
  getNeedsYouQueue,
  getCanvasserStats,
  getRecentCanvassActivity,
} from "@/lib/dashboard";
import type { Role } from "@/types";
import type { PlanTier } from "@/lib/plan-limits";
import { getEffectiveLimits } from "@/lib/plan-limits";
import { splitCampaignName } from "@/components/dashboard/dashboard-shared";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { OverviewTab } from "@/components/dashboard/tabs/overview-tab";
import { ActivityTab } from "@/components/dashboard/tabs/activity-tab";
import { FieldOpsTab } from "@/components/dashboard/tabs/field-ops-tab";
import { SupportersTab } from "@/components/dashboard/tabs/supporters-tab";
import { FinanceTab } from "@/components/dashboard/tabs/finance-tab";
import { GotvToggle } from "@/components/dashboard/gotv-toggle";

interface Props {
  campaignId: string;
  firstName: string;
  role: Role;
  plan?: PlanTier | null;
}

// ── Geo stats helper ──────────────────────────────────────────────────────

async function getPeopleGeoStats(campaignId: string) {
  const [activePeople, geocodedPeople] = await Promise.all([
    db.person.count({ where: { campaignId, deletedAt: null, anonymizedAt: null } }),
    db.person.count({
      where: {
        campaignId,
        deletedAt: null,
        anonymizedAt: null,
        household: { address: { lat: { not: null }, lng: { not: null } } },
      },
    }),
  ]);
  const geocodedPct = activePeople > 0 ? Math.round((geocodedPeople / activePeople) * 100) : 0;
  return { activePeople, geocodedPeople, geocodedPct };
}

// ── Component ──────────────────────────────────────────────────────────────

export async function CandidateDashboard({ campaignId, role, plan }: Props) {
  const isStarterPlan = plan === "bench";
  const showGeoStats = !isStarterPlan && (role === "candidate" || role === "campaign_manager" || role === "data_manager");

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const next72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  // ── Parallel data fetch ────────────────────────────────────────────────
  const [hero, data, needsYou, canvassers, liveActivity, upcomingEvents, geoStats] = await Promise.all([
    getDashboardHeroData(campaignId),
    getCandidateDashboardData(campaignId),
    getNeedsYouQueue(campaignId),
    getCanvasserStats(campaignId),
    getRecentCanvassActivity(campaignId),
    db.event.findMany({
      where: {
        campaignId,
        deletedAt: null,
        status: "upcoming",
        date: { gte: todayStart, lt: next72h },
      },
      orderBy: { date: "asc" },
      take: 3,
      select: {
        id: true,
        name: true,
        date: true,
        startTime: true,
        eventType: true,
        _count: { select: { attendees: true } },
      },
    }),
    showGeoStats ? getPeopleGeoStats(campaignId) : Promise.resolve(null),
  ]);

  // ── Destructure hero data ──────────────────────────────────────────────
  const {
    supportRate, totalPeople, contactedOnce, contactedTwice, contactedThreePlus,
    doorsToday, signsOut, totalRaised, electionDate, campaignName,
    doorsSeries, supportRateSeries, signsSeries, donorsSeries, doorsAvg7Day,
    gotvModeEnabled,
  } = hero;

  const {
    forUs, againstUs, undecided, notHome, uncontacted,
    walkListProgress, donorCountByStatus, competitorBreakdown,
  } = data;

  // ── Plan usage ─────────────────────────────────────────────────────────
  let constituentUsage: { count: number; limit: number } | null = null;
  let tagUsage: { count: number; limit: number } | null = null;

  if (role === "candidate" || role === "campaign_manager" || role === "data_manager") {
    const limits = await getEffectiveLimits(campaignId);
    if (!limits.isUnlimited("constituentLimit") && limits.constituentLimit > 0) {
      const count = await db.person.count({ where: { campaignId, deletedAt: null } });
      constituentUsage = { count, limit: limits.constituentLimit };
    }
    if (!limits.isUnlimited("tagLimit") && limits.tagLimit > 0) {
      const count = await db.tag.count({ where: { campaignId, deletedAt: null } });
      tagUsage = { count, limit: limits.tagLimit };
    }
  }

  const recordsNearLimit = constituentUsage ? constituentUsage.count / constituentUsage.limit >= 0.9 : false;
  const tagsNearLimit = tagUsage ? tagUsage.count / tagUsage.limit >= 0.9 : false;
  const showUpgradeWarning = recordsNearLimit || tagsNearLimit;

  // ── Computed values ────────────────────────────────────────────────────
  const totalContacted = contactedOnce + contactedTwice + contactedThreePlus;
  const reachedPct = totalPeople > 0 ? Math.round((totalContacted / totalPeople) * 100) : 0;
  const daysToElection = electionDate
    ? Math.max(0, Math.ceil((electionDate.getTime() - Date.now()) / 86400000))
    : null;
  const doorsDelta = doorsToday - doorsAvg7Day;
  const doorsBadge = doorsDelta >= 0 ? `+${doorsDelta} vs 7d avg` : `${doorsDelta} vs 7d avg`;
  const signsWeek = signsSeries.reduce((s, p) => s + p.count, 0);
  const raisedWeek = donorsSeries.reduce((s, p) => s + p.count, 0);
  const supportDelta =
    supportRateSeries.length >= 2
      ? supportRateSeries[supportRateSeries.length - 1].count - supportRateSeries[0].count
      : null;

  // ── Hero computed values ───────────────────────────────────────────────
  const nameSplit = campaignName ? splitCampaignName(campaignName) : null;
  const nameLine1 = nameSplit?.line1 ?? null;
  const nameLine2 = nameSplit?.line2 ?? null;
  const nameLine1Len = nameLine1?.length ?? 0;
  const nameLine1Size = nameLine1Len <= 14 ? "text-base" : "text-sm";
  const nameLine1Truncate = nameLine1Len > 22;

  // ── Tab definitions ────────────────────────────────────────────────────
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Activity" },
    { id: "field", label: "Field ops" },
    { id: "supporters", label: "Supporters" },
    ...(!isStarterPlan ? [{ id: "finance", label: "Finance" }] : []),
  ];

  return (
    <div className="flex flex-col h-full overflow-auto px-4 py-3 gap-3">

      {/* ── Hero band ── */}
      <div
        className="rounded-2xl px-5 py-4 relative overflow-hidden flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #1e293b, #334155)" }}
      >
        <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full bg-orange-500/10 translate-x-12 translate-y-8 pointer-events-none" />

        <div className="flex items-center relative z-10">
          {/* Campaign identity */}
          <div className="w-48 flex-shrink-0 pr-5">
            {nameLine1 && (
              <p
                className={[
                  nameLine1Size,
                  "font-medium text-white leading-tight",
                  nameLine1Truncate ? "truncate" : "",
                ].join(" ")}
                style={nameLine1Truncate ? { maxWidth: "200px" } : undefined}
              >
                {nameLine1}
              </p>
            )}
            {nameLine2 && (
              <p className="text-[13px] font-normal text-white/70 leading-tight mt-0.5">
                {nameLine2}
              </p>
            )}
            {daysToElection !== null && (
              <p className={["text-[11px] font-normal text-white/50", nameLine2 ? "mt-3" : "mt-1"].join(" ")}>
                {daysToElection > 0 ? `${daysToElection} days to election` : "Election day!"}
              </p>
            )}
            {(role === "candidate" || role === "campaign_manager" || role === "data_manager") && (
              <GotvToggle enabled={gotvModeEnabled} />
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-14 flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />

          {/* Support rate */}
          <div className="flex flex-col items-center w-36 flex-shrink-0 px-5">
            <p className="text-[11px] uppercase tracking-[0.06em] text-white/50">Support rate</p>
            <p className="text-[28px] font-medium text-white tabular-nums leading-none mt-1">
              {supportRate}%
            </p>
            {supportDelta !== null ? (
              <p
                className="text-[11px] mt-1"
                style={{
                  color: supportDelta > 0 ? "#4ade80"
                       : supportDelta < 0 ? "#fca5a5"
                       : "rgba(255,255,255,0.35)",
                }}
              >
                {supportDelta > 0 ? "+" : ""}{supportDelta} vs last week
              </p>
            ) : (
              <p className="text-[11px] mt-1 text-white/35">—</p>
            )}
          </div>

          <div className="w-px h-14 flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />

          {/* Coverage */}
          <div className="flex flex-col items-center flex-1 px-5">
            <p className="text-[11px] uppercase tracking-[0.06em] text-white/50">Coverage</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-[28px] font-medium text-white tabular-nums leading-none">
                {totalPeople.toLocaleString()}
              </p>
              <p className="text-[11px] text-white/40">total</p>
            </div>
            <div className="flex justify-between w-full max-w-[360px] mt-1">
              <span className="text-[11px]">
                <span className="font-medium tabular-nums" style={{ color: "#93c5fd" }}>
                  {contactedOnce.toLocaleString()}
                </span>
                <span className="text-white/45 ml-0.5">once</span>
              </span>
              <span className="text-[11px]">
                <span className="font-medium tabular-nums text-white/45">
                  {contactedTwice.toLocaleString()}
                </span>
                <span className="text-white/45 ml-0.5">twice</span>
              </span>
              <span className="text-[11px]">
                <span className="font-medium tabular-nums text-white/45">
                  {contactedThreePlus.toLocaleString()}
                </span>
                <span className="text-white/45 ml-0.5">3+</span>
              </span>
            </div>
          </div>

          <div className="w-px h-14 flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />

          {/* Reached */}
          <div className="flex flex-col items-center w-24 flex-shrink-0 pl-5">
            <p className="text-[11px] uppercase tracking-[0.06em] text-white/50">Reached</p>
            <p className="text-[28px] font-medium text-white tabular-nums leading-none mt-1">
              {reachedPct}%
            </p>
            <div className="h-1 rounded-full bg-white/10 overflow-hidden w-full mt-1.5">
              <div
                className="h-full rounded-full"
                style={{ width: `${reachedPct}%`, background: "#3b82f6" }}
              />
            </div>
          </div>

          {/* Opponents */}
          {competitorBreakdown.length > 0 && (
            <>
              <div className="w-px h-14 flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />
              <div className="flex flex-col w-[150px] flex-shrink-0 pl-5">
                <p className="text-[11px] uppercase tracking-[0.06em] text-white/50">Opponents</p>
                {competitorBreakdown.slice(0, 3).map((comp, i) => {
                  const maxCount = competitorBreakdown[0].count;
                  const pct = maxCount > 0 ? Math.round((comp.count / maxCount) * 100) : 0;
                  return (
                    <div key={comp.name} className={i === 0 ? "mt-1.5" : "mt-1"}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-white/60 truncate max-w-[95px]">{comp.name}</span>
                        <span className="text-[11px] font-semibold tabular-nums text-red-300">{comp.count}</span>
                      </div>
                      <div className="h-[3px] rounded-full bg-white/[0.08] overflow-hidden mt-0.5">
                        <div
                          className="h-full rounded-full bg-red-400 transition-all"
                          style={{ width: `${pct}%`, opacity: i === 0 ? 1 : 0.7 }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-white/35 mt-1.5">
                  {competitorBreakdown.reduce((s, c) => s + c.count, 0).toLocaleString()} total for opponents
                </p>
              </div>
            </>
          )}

          {/* Plan usage (hero inline) */}
          {(constituentUsage || tagUsage) && (
            <>
              <div className="w-px h-14 flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />
              <div className="flex flex-col w-36 flex-shrink-0 pl-5 gap-2">
                <p className="text-[11px] uppercase tracking-[0.06em] text-white/50">Plan usage</p>
                {constituentUsage && (
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-white/40">Records</span>
                      <span className="text-[10px] font-medium text-white/60 tabular-nums">
                        {constituentUsage.count.toLocaleString()} / {constituentUsage.limit.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round((constituentUsage.count / constituentUsage.limit) * 100))}%`,
                          background: constituentUsage.count / constituentUsage.limit >= 0.9 ? "#f87171"
                            : constituentUsage.count / constituentUsage.limit >= 0.75 ? "#fbbf24" : "#94a3b8",
                        }}
                      />
                    </div>
                  </div>
                )}
                {tagUsage && (
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-white/40">Tags</span>
                      <span className="text-[10px] font-medium text-white/60 tabular-nums">
                        {tagUsage.count.toLocaleString()} / {tagUsage.limit.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round((tagUsage.count / tagUsage.limit) * 100))}%`,
                          background: tagUsage.count / tagUsage.limit >= 0.9 ? "#f87171"
                            : tagUsage.count / tagUsage.limit >= 0.75 ? "#fbbf24" : "#94a3b8",
                        }}
                      />
                    </div>
                  </div>
                )}
                {showUpgradeWarning && (
                  <Link
                    href="/onboarding/choose-plan"
                    className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-amber-300 hover:text-amber-200 transition-colors"
                  >
                    <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    Upgrade plan
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Starter plan upgrade prompt ── */}
      {isStarterPlan && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-slate-800">Upgrade to Campaign for detailed analytics</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Unlock donor tracking, follow-up queue, live activity feed, and performance leaderboards.
            </p>
          </div>
          <Link
            href="/onboarding/choose-plan"
            className="flex-shrink-0 ml-6 h-9 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
          >
            Upgrade
          </Link>
        </div>
      )}

      {/* ── Tabbed folder ── */}
      <DashboardTabs tabs={tabs} defaultTab="overview">
        {/* Overview tab */}
        <OverviewTab
          doorsToday={doorsToday}
          doorsDelta={doorsDelta}
          doorsBadge={doorsBadge}
          doorsSeries={doorsSeries}
          supportRate={supportRate}
          supportRateSeries={supportRateSeries}
          signsOut={signsOut}
          signsWeek={signsWeek}
          signsSeries={signsSeries}
          totalRaised={totalRaised}
          raisedWeek={raisedWeek}
          donorsSeries={donorsSeries}
          isStarterPlan={isStarterPlan}
          forUs={forUs}
          undecided={undecided}
          againstUs={againstUs}
          notHome={notHome}
          uncontacted={uncontacted}
          totalPeople={totalPeople}
          needsYou={needsYou}
        />

        {/* Activity tab */}
        <ActivityTab liveActivity={liveActivity} />

        {/* Field ops tab */}
        <FieldOpsTab
          walkListProgress={walkListProgress}
          doorsSeries={doorsSeries}
          canvassers={canvassers}
          upcomingEvents={upcomingEvents}
          geoStats={geoStats}
        />

        {/* Supporters tab */}
        <SupportersTab
          forUs={forUs}
          againstUs={againstUs}
          undecided={undecided}
          notHome={notHome}
          uncontacted={uncontacted}
          totalPeople={totalPeople}
          supportRate={supportRate}
          supportDelta={supportDelta}
          reachedPct={reachedPct}
          supportRateSeries={supportRateSeries}
          competitorBreakdown={competitorBreakdown}
        />

        {/* Finance tab (Campaign+ plans only) */}
        {!isStarterPlan && (
          <FinanceTab
            donorCountByStatus={donorCountByStatus}
            donorsSeries={donorsSeries}
            signsOut={signsOut}
            signsWeek={signsWeek}
            signsSeries={signsSeries}
            totalRaised={totalRaised}
            constituentUsage={constituentUsage}
            tagUsage={tagUsage}
            showUpgradeWarning={showUpgradeWarning}
          />
        )}
      </DashboardTabs>
    </div>
  );
}
