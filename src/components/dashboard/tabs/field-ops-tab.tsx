import Link from "next/link";
import { WalkListRow, LeaderboardRow, GeoStatCard } from "@/components/dashboard/dashboard-shared";
import { BarSparkline } from "@/components/dashboard/sparkline-charts";
import type { SeriesPoint } from "@/components/dashboard/sparkline-charts";
import type { CanvasserStat } from "@/lib/dashboard";

interface UpcomingEvent {
  id: string;
  name: string;
  date: Date;
  startTime: string | null;
  eventType: string;
  _count: { attendees: number };
}

interface FieldOpsTabProps {
  walkListProgress: {
    id: string;
    name: string;
    totalEntries: number;
    totalResponses: number;
    canvasserNames: string[];
  }[];
  doorsSeries: SeriesPoint[];
  canvassers: CanvasserStat[];
  upcomingEvents: UpcomingEvent[];
  geoStats: { activePeople: number; geocodedPeople: number; geocodedPct: number } | null;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  campaign_event: "#f97316",
  fundraiser: "#22c55e",
  town_hall: "#06b6d4",
  debate: "#ef4444",
  canvass_kickoff: "#f97316",
  volunteer_training: "#8b5cf6",
  other: "#94a3b8",
};

export function FieldOpsTab({
  walkListProgress,
  doorsSeries,
  canvassers,
  upcomingEvents,
  geoStats,
}: FieldOpsTabProps) {
  const lists = walkListProgress.slice(0, 5);
  const leaderboard = canvassers.slice(0, 5);

  return (
    <div className="flex flex-col gap-3">
      {/* Walk lists */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Walk lists</p>
          <Link href="/canvassing" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
            all lists →
          </Link>
        </div>
        {lists.length === 0 ? (
          <p className="text-xs text-slate-400 mb-2">No walk lists created.</p>
        ) : (
          <div className="flex flex-col gap-2.5 mb-3">
            {lists.map((l) => (
              <WalkListRow key={l.id} list={l} />
            ))}
          </div>
        )}
        <div className="mt-auto min-h-0">
          <BarSparkline data={doorsSeries} height={56} yLabel="Doors · 7-day trend" />
        </div>
      </div>

      {/* Canvassers + Events side by side */}
      <div className="grid grid-cols-2 gap-3">
        {/* Canvasser leaderboard */}
        <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Top canvassers
          </p>
          {leaderboard.length === 0 ? (
            <p className="text-xs text-slate-400">No canvass data yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {leaderboard.map((c, i) => (
                <LeaderboardRow key={c.canvasserId} rank={i + 1} canvasser={c} />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming events */}
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Up next · 72h
          </p>
          {upcomingEvents.length === 0 ? (
            <p className="text-xs text-slate-400">No events in the next 72 hours.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingEvents.map((ev) => {
                const dotColor = EVENT_TYPE_COLORS[ev.eventType as string] ?? "#94a3b8";
                const dateStr = new Date(ev.date).toLocaleDateString("en-CA", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <div key={ev.id} className="flex items-start gap-2">
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0 mt-1"
                      style={{ background: dotColor }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{ev.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {dateStr} · {ev.startTime ?? "TBD"} · {ev._count.attendees} attending
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Geocoding coverage */}
      {geoStats && (
        <div className="grid grid-cols-3 gap-3">
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
    </div>
  );
}
