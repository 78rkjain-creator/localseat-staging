import Link from "next/link";
import { db } from "@/lib/db";
import {
  getDashboardHeroData,
  getCandidateDashboardData,
  getNeedsYouQueue,
  getCanvasserStats,
  getRecentCanvassActivity,
} from "@/lib/dashboard";
import { CanvassActivityFeed } from "@/components/dashboard/canvass-activity-feed";
import { BarSparkline, LineSparkline } from "@/components/dashboard/sparkline-charts";
import type { DonorStatus, Role } from "@/types";
import { DONOR_STATUS_LABELS } from "@/types";

interface Props {
  campaignId: string;
  firstName: string;
  role: Role;
}

// Matches the EventType enum values in the Prisma schema
const EVENT_TYPE_COLORS: Record<string, string> = {
  campaign_event:     "#f97316",
  fundraiser:         "#22c55e",
  town_hall:          "#06b6d4",
  debate:             "#ef4444",
  canvass_kickoff:    "#f97316",
  volunteer_training: "#8b5cf6",
  other:              "#94a3b8",
};

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

export async function CandidateDashboard({ campaignId, role }: Props) {
  const showGeoStats = role === "candidate" || role === "campaign_manager";

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const next72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

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

  const {
    supportRate, totalPeople, contactedOnce, contactedTwice, contactedThreePlus,
    doorsToday, signsOut, totalRaised, fundraisingGoal, electionDate, campaignName,
    doorsSeries, supportRateSeries, signsSeries, donorsSeries, doorsAvg7Day,
  } = hero;

  const {
    forUs, againstUs, undecided, notHome, uncontacted,
    walkListProgress, donorCountByStatus,
  } = data;

  const totalContacted = contactedOnce + contactedTwice + contactedThreePlus;
  const reachedPct = totalPeople > 0 ? Math.round((totalContacted / totalPeople) * 100) : 0;

  const daysToElection = electionDate
    ? Math.max(0, Math.ceil((electionDate.getTime() - Date.now()) / 86400000))
    : null;

  const doorsDelta = doorsToday - doorsAvg7Day;
  const doorsBadge = doorsDelta >= 0 ? `+${doorsDelta} vs 7d avg` : `${doorsDelta} vs 7d avg`;
  const signsWeek = signsSeries.reduce((s, p) => s + p.count, 0);
  const raisedWeek = donorsSeries.reduce((s, p) => s + p.count, 0);

  void fundraisingGoal;

  // Hero computed values
  const nameSplit = campaignName ? splitCampaignName(campaignName) : null;
  const nameLine1 = nameSplit?.line1 ?? null;
  const nameLine2 = nameSplit?.line2 ?? null;
  const nameLine1Len = nameLine1?.length ?? 0;
  const nameLine1Size = nameLine1Len <= 14 ? "text-base" : "text-sm";
  const nameLine1Truncate = nameLine1Len > 22;
  const supportDelta =
    supportRateSeries.length >= 2
      ? supportRateSeries[supportRateSeries.length - 1].count - supportRateSeries[0].count
      : null;

  const idTotal = forUs + againstUs + undecided;
  const leaderboard = canvassers.slice(0, 3);
  const lists = walkListProgress.slice(0, 4);

  return (
    <div className="flex flex-col h-full overflow-hidden px-4 py-4 gap-3">

      {/* ── Hero band ── */}
      <div
        className="rounded-2xl px-5 py-4 relative overflow-hidden flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #1e293b, #334155)" }}
      >
        <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full bg-orange-500/10 translate-x-12 translate-y-8 pointer-events-none" />

        <div className="flex items-center relative z-10">

          {/* 1 ── Campaign identity */}
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
          </div>

          {/* divider */}
          <div className="w-px h-14 flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />

          {/* 2 ── Support rate */}
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

          {/* divider */}
          <div className="w-px h-14 flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />

          {/* 3 ── Coverage */}
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

          {/* divider */}
          <div className="w-px h-14 flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />

          {/* 4 ── Reached */}
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

        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <KpiCard
          label="Doors today"
          value={doorsToday}
          badge={doorsBadge}
          badgeColor={doorsDelta >= 0 ? "green" : "amber"}
        >
          <BarSparkline data={doorsSeries} />
        </KpiCard>
        <KpiCard
          label="Support %"
          value={`${supportRate}%`}
          badge={`${supportRate}% of ID'd voters`}
          badgeColor="green"
        >
          <LineSparkline data={supportRateSeries} />
        </KpiCard>
        <KpiCard
          label="Signs out"
          value={signsOut}
          badge={`+${signsWeek} this week`}
          badgeColor={signsWeek > 0 ? "green" : "amber"}
        >
          <BarSparkline data={signsSeries} />
        </KpiCard>
        <KpiCard
          label="Donors"
          value={totalRaised}
          badge={`+${raisedWeek} received`}
          badgeColor={raisedWeek > 0 ? "green" : "amber"}
        >
          <LineSparkline data={donorsSeries} />
        </KpiCard>
      </div>

      {/* ── Geocoding coverage (candidate + campaign_manager only) ── */}
      {showGeoStats && geoStats && (
        <div className="grid grid-cols-3 gap-3 flex-shrink-0">
          <GeoStatCard
            label="People"
            value={geoStats.activePeople.toLocaleString()}
            description="Active records in this campaign"
          />
          <GeoStatCard
            label="Geocoded"
            value={geoStats.geocodedPeople.toLocaleString()}
            description="With a mapped address"
          />
          <GeoStatCard
            label="Coverage"
            value={`${geoStats.geocodedPct}%`}
            description="Of people geocoded"
          />
        </div>
      )}

      {/* ── Panel grid ── */}
      <div className="grid grid-cols-12 grid-rows-2 gap-3 flex-1 min-h-0">

        {/* ── Row 1 ── */}

        {/* Voter ID mix — col-span-4 */}
        <div className="col-span-4 bg-white border border-slate-200 rounded-xl p-3 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Voter ID mix</p>
            <Link href="/people/residents" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">details →</Link>
          </div>
          {idTotal > 0 ? (
            <div className="space-y-1.5 mb-2">
              {[
                { label: "For us",        value: forUs,       color: "#10b981" },
                { label: "Undecided",     value: undecided,   color: "#f59e0b" },
                { label: "Against",       value: againstUs,   color: "#ef4444" },
                { label: "Not home",      value: notHome,     color: "#cbd5e1" },
                { label: "Not contacted", value: uncontacted, color: "#f1f5f9" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] text-slate-500 flex-1 min-w-0 truncate">{label}</span>
                    <span className="text-[11px] font-semibold text-slate-700 tabular-nums flex-shrink-0">{value.toLocaleString()}</span>
                  </div>
                  <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${totalPeople > 0 ? (value / totalPeople) * 100 : 0}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-2">No voter ID data yet.</p>
          )}
          <div className="mt-auto min-h-0">
            <p className="text-[10px] text-slate-400 mb-1">Support % · 7-day trend</p>
            <LineSparkline data={supportRateSeries} height={32} />
          </div>
        </div>

        {/* Action queue — col-span-4 */}
        <div className="col-span-4 bg-white border border-slate-200 rounded-xl p-3 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">For you</p>
            <Link href="/follow-ups" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">queue →</Link>
          </div>
          {needsYou.length === 0 ? (
            <p className="text-sm text-slate-400 mt-1">All clear — nothing urgent.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {needsYou.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={[
                      "h-1.5 w-1.5 rounded-full flex-shrink-0",
                      item.priority === "overdue" ? "bg-red-500" :
                      item.priority === "today" ? "bg-amber-400" : "bg-slate-300",
                    ].join(" ")} />
                    <span className="text-sm text-slate-700 truncate">
                      <span className="font-semibold">{item.count}</span> {item.label}
                    </span>
                  </div>
                  <span className={[
                    "text-[10px] font-semibold border rounded-full px-1.5 py-0.5 flex-shrink-0",
                    item.priority === "overdue"
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-amber-50 text-amber-700 border-amber-200",
                  ].join(" ")}>
                    {item.priority === "overdue" ? "overdue" : "today"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Field ops — col-span-4 */}
        <div className="col-span-4 bg-white border border-slate-200 rounded-xl p-3 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Field ops</p>
            <Link href="/canvassing" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">all lists →</Link>
          </div>
          {lists.length === 0 ? (
            <p className="text-xs text-slate-400 mb-2">No walk lists created.</p>
          ) : (
            <div className="flex flex-col gap-2 mb-2">
              {lists.map((l) => {
                const pct = l.totalEntries > 0
                  ? Math.min(100, Math.round((l.totalResponses / l.totalEntries) * 100))
                  : 0;
                return (
                  <div key={l.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <Link
                        href={`/canvassing/${l.id}`}
                        className="text-sm font-medium text-slate-800 hover:text-slate-600 truncate"
                      >
                        {l.name}
                      </Link>
                      <span className="text-[11px] text-slate-500 flex-shrink-0 ml-2">
                        {l.totalResponses}/{l.totalEntries}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 60 ? "bg-emerald-400" : pct >= 30 ? "bg-amber-400" : "bg-red-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-auto min-h-0">
            <p className="text-[10px] text-slate-400 mb-1">Doors · 7-day trend</p>
            <BarSparkline data={doorsSeries} height={32} />
          </div>
        </div>

        {/* ── Row 2 ── */}

        {/* Live activity — col-span-4 */}
        <div className="col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden min-h-0">
          <CanvassActivityFeed initialEntries={liveActivity.slice(0, 4)} />
        </div>

        {/* Donor pipeline — col-span-5 */}
        <div className="col-span-5 bg-white border border-slate-200 rounded-xl p-3 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Donor pipeline</p>
            <Link href="/donors" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">all donors →</Link>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(["interested", "pledged", "received"] as DonorStatus[]).map((s) => {
              const count = donorCountByStatus[s] ?? 0;
              const styles: Record<DonorStatus, string> = {
                interested: "bg-amber-50 border-amber-200 text-amber-700",
                pledged: "bg-blue-50 border-blue-200 text-blue-700",
                received: "bg-emerald-50 border-emerald-200 text-emerald-700",
              };
              return (
                <div key={s} className={`rounded-lg border p-2.5 ${styles[s]}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-1">
                    {DONOR_STATUS_LABELS[s]}
                  </p>
                  <p className="text-xl font-bold tabular">{count}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-auto min-h-0">
            <p className="text-[10px] text-slate-400 mb-1">Donors received · 7-day trend</p>
            <LineSparkline data={donorsSeries} height={40} />
          </div>
        </div>

        {/* Leaderboard + Up next — col-span-3 */}
        <div className="col-span-3 flex flex-col gap-3 min-h-0 overflow-hidden">

          {/* Leaderboard */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Top canvassers</p>
            {leaderboard.length === 0 ? (
              <p className="text-xs text-slate-400">No canvass data yet.</p>
            ) : (
              <div className="flex flex-col gap-1 overflow-hidden">
                {leaderboard.map((c, i) => (
                  <div
                    key={c.canvasserId}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                      i === 0 ? "bg-amber-50/80" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-[11px] font-bold text-slate-400 w-3 text-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
                    >
                      {c.firstName[0]}{c.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800 truncate">
                        {c.firstName} {c.lastName}
                      </p>
                      {c.lastActive && (
                        <p className="text-[10px] text-slate-400">{relativeTime(c.lastActive)}</p>
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-700 tabular flex-shrink-0">
                      {c.totalDoors}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Up next · 72h */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex-shrink-0 overflow-hidden">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Up next · 72h
            </p>
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-slate-400">No events in the next 72 hours.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingEvents.map((ev) => {
                  const borderColor = EVENT_TYPE_COLORS[ev.eventType as string] ?? "#94a3b8";
                  const dateStr = new Date(ev.date).toLocaleDateString("en-CA", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
                  return (
                    <div key={ev.id} className="pl-2.5 border-l-2" style={{ borderColor }}>
                      <p className="text-xs font-medium text-slate-800 truncate">{ev.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {dateStr} · {ev.startTime} · {ev._count.attendees} attending
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function splitCampaignName(name: string): { line1: string; line2?: string } {
  const separators = [" — ", " – ", " - ", ", "];
  for (const sep of separators) {
    const idx = name.indexOf(sep);
    if (idx > 0) {
      return {
        line1: name.slice(0, idx).trim(),
        line2: name.slice(idx + sep.length).trim(),
      };
    }
  }
  return { line1: name };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function GeoStatCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-[22px] font-bold text-slate-900 tabular leading-none mt-1">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{description}</p>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  badge,
  badgeColor = "green",
  children,
}: {
  label: string;
  value: string | number;
  badge?: string;
  badgeColor?: "green" | "amber";
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col">
      <div className="flex items-start justify-between mb-1">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        {badge && (
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-1 flex-shrink-0 ${
              badgeColor === "green"
                ? "bg-[#dcfce7] text-[#16a34a]"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="text-[22px] font-bold text-slate-900 tabular leading-none mb-2">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {children}
    </div>
  );
}
