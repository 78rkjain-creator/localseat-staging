import Link from "next/link";
import { db } from "@/lib/db";
import { getAssignedLists } from "@/lib/canvassing";
import { getActiveFieldMessages } from "@/lib/field-messages";
import { FieldMessagesBanner } from "@/components/field-messages-banner";

interface Props {
  userId: string;
  campaignId: string;
  firstName: string;
}

export async function CanvasserHome({ userId, campaignId, firstName }: Props) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const statsWhere = {
    assignment: {
      canvasserId: userId,
      canvassList: { campaignId },
      deletedAt: null,
    },
  } as const;

  const [assignments, tasks, totalDoors, doorsToday, doorsLast7Days, followUps, fieldMessages] =
    await Promise.all([
      getAssignedLists(userId, campaignId),
      db.task.findMany({
        where: { campaignId, assignedTo: userId, completed: false, deletedAt: null },
        include: {
          person: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      }),
      db.canvassResponse.count({ where: statsWhere }),
      db.canvassResponse.count({ where: { ...statsWhere, respondedAt: { gte: todayStart } } }),
      db.canvassResponse.count({
        where: { ...statsWhere, respondedAt: { gte: sevenDaysAgo, lt: todayStart } },
      }),
      db.canvassResponse.count({ where: { ...statsWhere, needsFollowUp: true } }),
      getActiveFieldMessages(campaignId),
    ]);

  const doorsAvg = Math.round(doorsLast7Days / 7);
  const doorsDelta = doorsToday - doorsAvg;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const initials = firstName.slice(0, 2).toUpperCase();
  const now = new Date();

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Hero ── */}
      <div
        className="px-4 pt-5 pb-5"
        style={{ background: "linear-gradient(135deg, #334155, #475569)" }}
      >
        {/* Greeting row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[13px] text-white/60">{greeting},</p>
            <p className="text-[22px] font-bold text-white leading-tight">{firstName}</p>
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mt-0.5">
              My canvassing
            </p>
          </div>
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: "#f97316" }}
          >
            {initials}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className="rounded-xl p-2.5 text-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <p className="text-[26px] font-medium text-white leading-none">{doorsToday}</p>
            <p className="text-[11px] uppercase text-white/75 mt-1 leading-none">Doors today</p>
            {doorsAvg > 0 && (
              <p className={`text-[10px] font-semibold mt-1.5 ${doorsDelta >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {doorsDelta >= 0 ? `+${doorsDelta}` : doorsDelta} vs avg
              </p>
            )}
          </div>
          <div
            className="rounded-xl p-2.5 text-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <p className="text-[26px] font-medium text-white leading-none">{totalDoors}</p>
            <p className="text-[11px] uppercase text-white/75 mt-1 leading-none">Total doors</p>
          </div>
          <div
            className="rounded-xl p-2.5 text-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <p
              className={`text-[26px] font-medium leading-none ${followUps > 0 ? "text-amber-300" : "text-white"}`}
            >
              {followUps}
            </p>
            <p className="text-[11px] uppercase text-white/75 mt-1 leading-none">Follow-ups</p>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {fieldMessages.length > 0 && <FieldMessagesBanner messages={fieldMessages} />}

        {/* Walk lists */}
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
            My walk lists
          </p>

          {assignments.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
              <p className="text-sm font-medium text-slate-700 mb-1">No lists assigned yet</p>
              <p className="text-xs text-slate-400">
                Your organizer will assign you a walk list when you&apos;re ready to start.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {assignments.map((a, index) => {
                const pct =
                  a.totalEntries > 0
                    ? Math.min(100, Math.round((a.totalResponses / a.totalEntries) * 100))
                    : 0;
                const complete = a.totalEntries > 0 && a.totalResponses >= a.totalEntries;
                const isPrimary = index === 0;

                const badgeClass = complete
                  ? "bg-emerald-50 text-emerald-700"
                  : pct >= 60
                  ? "bg-emerald-50 text-emerald-700"
                  : pct >= 30
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700";

                const barColor = complete
                  ? "bg-emerald-400"
                  : pct >= 60
                  ? "bg-emerald-400"
                  : pct >= 30
                  ? "bg-amber-400"
                  : "bg-red-400";

                const primaryLabel = complete
                  ? "Review list"
                  : a.totalResponses > 0
                  ? "Continue canvassing"
                  : "Start canvassing";

                const secondaryLabel = complete ? "Review" : "Continue";

                return (
                  <div key={a.assignmentId} className={[
                    "bg-white rounded-xl border border-slate-200 p-3",
                    isPrimary ? "border-l-[3px] border-l-brand-400" : "",
                  ].join(" ")}>
                    {/* Top row */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{a.list.name}</p>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeClass}`}
                      >
                        {complete ? "Done" : `${pct}%`}
                      </span>
                    </div>

                    {/* Subtitle */}
                    <p className="text-[11px] text-slate-400 mb-2">
                      {a.totalEntries} doors
                      {a.list.description ? ` · ${a.list.description}` : ""}
                    </p>

                    {/* Progress bar */}
                    <div className="h-1 rounded-full bg-slate-100 overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Button row */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/canvassing/${a.list.id}/canvass`}
                        className={[
                          "flex-1 flex items-center justify-center h-9 rounded-lg text-sm font-semibold transition-colors",
                          isPrimary && !complete
                            ? "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                        ].join(" ")}
                      >
                        {isPrimary ? primaryLabel : secondaryLabel}
                      </Link>
                      <Link
                        href={`/canvassing/${a.list.id}`}
                        className="h-9 px-3 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
                      >
                        Map
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Follow-up tasks */}
        {tasks.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Follow-up tasks
            </p>
            <div className="flex flex-col gap-2">
              {tasks.map((task) => {
                const overdue = task.dueDate && task.dueDate < now;
                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 leading-snug">
                          {task.title}
                        </p>
                        {task.person && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {task.person.firstName} {task.person.lastName}
                          </p>
                        )}
                      </div>
                      {task.dueDate && (
                        <span
                          className={[
                            "flex-shrink-0 text-xs font-medium rounded-full px-2.5 py-1",
                            overdue
                              ? "bg-red-50 text-red-600 border border-red-200"
                              : "bg-slate-100 text-slate-500",
                          ].join(" ")}
                        >
                          {task.dueDate.toLocaleDateString("en-CA", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                    {task.notes && (
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2">{task.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
