import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { Role } from "@/types";
import {
  canManageFollowUps,
  isReadOnly,
} from "@/lib/permissions";
import {
  getFullFollowUpQueue,
  getMyFollowUpTasks,
  getCampaignTeamMembers,
  type FollowUpTask,
} from "@/lib/follow-ups";
import { completeTask } from "./actions";
import { AssignForm } from "./assign-form";

export const metadata: Metadata = { title: "Follow-ups" };

export default async function FollowUpsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole, id: userId } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  const role = activeRole as Role;
  const isManager = canManageFollowUps(role);
  const readOnly = isReadOnly(role);

  console.log("[follow-ups] userId:", userId, "| activeCampaignId:", activeCampaignId, "| activeRole:", activeRole, "| isManager:", isManager);

  if (isManager) {
    const [queue, teamMembers] = await Promise.all([
      getFullFollowUpQueue(activeCampaignId),
      readOnly ? Promise.resolve([]) : getCampaignTeamMembers(activeCampaignId),
    ]);

    console.log("[follow-ups] unassigned:", queue.unassigned.length, "| assigned:", queue.assigned.length);

    return (
      <ManagerView
        unassigned={queue.unassigned}
        assigned={queue.assigned}
        teamMembers={teamMembers}
        readOnly={readOnly}
      />
    );
  }

  // Canvasser and other roles see only their own assigned tasks
  const tasks = await getMyFollowUpTasks(userId, activeCampaignId);
  return <CanvasserView tasks={tasks} />;
}

// ── Manager / organizer view ───────────────────────────────────────────────

function ManagerView({
  unassigned,
  assigned,
  teamMembers,
  readOnly,
}: {
  unassigned: FollowUpTask[];
  assigned: FollowUpTask[];
  teamMembers: { id: string; firstName: string; lastName: string; role: string }[];
  readOnly: boolean;
}) {
  const now = new Date();

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Follow-ups</h1>
        <p className="text-slate-500 mt-1 text-sm">
          {unassigned.length} unassigned · {assigned.length} assigned
        </p>
      </div>

      {/* Unassigned */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Unassigned ({unassigned.length})
        </h2>

        {unassigned.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 px-5 py-8 text-center">
            <p className="text-sm font-medium text-slate-700 mb-1">All clear</p>
            <p className="text-xs text-slate-400">No unassigned follow-ups right now.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {unassigned.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                now={now}
                teamMembers={teamMembers}
                showAssign={!readOnly}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
      </section>

      {/* Assigned */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Assigned ({assigned.length})
        </h2>

        {assigned.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 px-5 py-8 text-center">
            <p className="text-sm text-slate-400">No assigned tasks right now.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {assigned.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                now={now}
                teamMembers={teamMembers}
                showAssign={!readOnly}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Canvasser view ─────────────────────────────────────────────────────────

function CanvasserView({ tasks }: { tasks: FollowUpTask[] }) {
  const now = new Date();

  return (
    <div className="px-4 sm:px-6 py-8 max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My follow-ups</h1>
        <p className="text-slate-500 mt-1 text-sm">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""} assigned to you
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700 mb-1">No follow-ups</p>
          <p className="text-xs text-slate-400">You have no tasks assigned to you right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} now={now} teamMembers={[]} showAssign={false} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Task card ──────────────────────────────────────────────────────────────

function TaskCard({
  task,
  now,
  teamMembers,
  showAssign,
  readOnly = false,
}: {
  task: FollowUpTask;
  now: Date;
  teamMembers: { id: string; firstName: string; lastName: string; role: string }[];
  showAssign: boolean;
  readOnly?: boolean;
}) {
  const isOverdue = task.dueDate && task.dueDate < now;
  const isDueToday =
    task.dueDate &&
    task.dueDate >= now &&
    task.dueDate.toDateString() === now.toDateString();

  const address = task.person?.address;
  const addressLine = address
    ? `${address.streetNumber} ${address.streetName}${address.unitNumber ? ` #${address.unitNumber}` : ""}, ${address.city}`
    : null;

  // Extract "Flagged by X" from notes prefix (set by saveCanvassResponse)
  let flaggedBy: string | null = null;
  let displayNotes: string | null = task.notes;
  if (task.notes?.startsWith("Flagged by ")) {
    const parts = task.notes.split("\n\n");
    flaggedBy = parts[0].replace("Flagged by ", "");
    displayNotes = parts.slice(1).join("\n\n") || null;
  }

  return (
    <div
      className={[
        "bg-white rounded-2xl border px-5 py-4",
        isOverdue ? "border-red-200" : "border-slate-100",
      ].join(" ")}
    >
      {/* Top row: person + status badges */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-base leading-tight">
            {task.person
              ? `${task.person.firstName} ${task.person.lastName}`
              : task.title}
          </p>
          {addressLine && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{addressLine}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isOverdue && (
            <span className="text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5">
              Overdue
            </span>
          )}
          {isDueToday && !isOverdue && (
            <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
              Due today
            </span>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-3">
        {flaggedBy && <span>Flagged by {flaggedBy}</span>}
        {task.assignee && (
          <span>
            Assigned to{" "}
            <span className="font-medium text-slate-700">
              {task.assignee.firstName} {task.assignee.lastName}
            </span>
          </span>
        )}
        {task.dueDate && (
          <span>
            Due {task.dueDate.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
          </span>
        )}
        <span>Added {task.createdAt.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
      </div>

      {/* Note */}
      {displayNotes && (
        <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2 mb-3 leading-snug">
          {displayNotes}
        </p>
      )}

      {/* Actions */}
      {!readOnly && (
      <div className="flex items-center gap-2 flex-wrap">
        {/* Complete button — available to everyone except co_chair */}
        <form
          action={async () => {
            "use server";
            await completeTask(task.id);
          }}
        >
          <button
            type="submit"
            className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            Mark complete
          </button>
        </form>

        {/* Assign selector — managers only */}
        {showAssign && (
          <AssignForm
            taskId={task.id}
            currentAssigneeId={task.assignee?.id}
            teamMembers={teamMembers}
          />
        )}
      </div>
      )}
    </div>
  );
}
