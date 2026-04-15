import Link from "next/link";
import { db } from "@/lib/db";
import { getAssignedLists } from "@/lib/canvassing";

interface Props {
  userId: string;
  campaignId: string;
  firstName: string;
}

export async function CanvasserHome({ userId, campaignId, firstName }: Props) {
  const [assignments, tasks] = await Promise.all([
    getAssignedLists(userId, campaignId),
    db.task.findMany({
      where: { campaignId, assignedTo: userId, completed: false, deletedAt: null },
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const now = new Date();

  return (
    <div className="px-4 sm:px-6 py-8 max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Good to see you, {firstName}</h1>
        <p className="text-slate-500 mt-1 text-sm">Canvasser</p>
      </div>

      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">My walk lists</h2>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-5 py-8 text-center mb-8">
          <p className="text-sm font-medium text-slate-700 mb-1">No lists assigned yet</p>
          <p className="text-xs text-slate-400">
            Your organizer will assign you a walk list when you&apos;re ready to start.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-8">
          {assignments.map((a) => {
            const pct =
              a.totalEntries > 0 ? Math.round((a.totalResponses / a.totalEntries) * 100) : 0;
            const remaining = a.totalEntries - a.totalResponses;
            const started = a.totalResponses > 0;
            const complete = remaining === 0 && a.totalEntries > 0;

            return (
              <div
                key={a.assignmentId}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm px-5 py-5"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 leading-snug">{a.list.name}</p>
                    {a.list.description && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{a.list.description}</p>
                    )}
                  </div>
                  {complete && (
                    <span className="flex-shrink-0 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1">
                      Done
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={["h-full rounded-full transition-all", complete ? "bg-emerald-500" : "bg-brand-500"].join(" ")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs text-slate-400">
                    <span>{a.totalResponses} of {a.totalEntries} doors</span>
                    <span>{pct}%</span>
                  </div>
                </div>

                <Link
                  href={`/canvassing/${a.list.id}/canvass`}
                  className={[
                    "flex items-center justify-center gap-2 h-14 w-full rounded-2xl font-semibold text-sm transition-colors",
                    complete
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      : "bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-sm",
                  ].join(" ")}
                >
                  {complete ? "Review list" : started ? "Continue canvassing" : "Start canvassing"}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {tasks.length > 0 && (
        <>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Follow-up tasks</h2>
          <div className="flex flex-col gap-2">
            {tasks.map((task) => {
              const overdue = task.dueDate && task.dueDate < now;
              return (
                <div key={task.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug">{task.title}</p>
                      {task.person && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {task.person.firstName} {task.person.lastName}
                        </p>
                      )}
                    </div>
                    {task.dueDate && (
                      <span className={[
                        "flex-shrink-0 text-xs font-medium rounded-full px-2.5 py-1",
                        overdue ? "bg-red-50 text-red-600 border border-red-200" : "bg-slate-100 text-slate-500",
                      ].join(" ")}>
                        {task.dueDate.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
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
        </>
      )}
    </div>
  );
}
