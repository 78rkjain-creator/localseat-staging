import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Follow-up Status" };

interface AssigneeRow {
  name: string;
  open: number;
  overdue: number;
  completed: number;
}

export default async function FollowUpStatusPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewReports(activeRole as Role)) redirect("/dashboard");

  const campaignId = activeCampaignId;
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [openCount, overdueCount, completedThisWeek, allTasks] = await Promise.all([
    db.task.count({
      where: { campaignId, completed: false, deletedAt: null },
    }),
    db.task.count({
      where: {
        campaignId,
        completed: false,
        deletedAt: null,
        dueDate: { lt: now },
      },
    }),
    db.task.count({
      where: {
        campaignId,
        completed: true,
        deletedAt: null,
        completedAt: { gte: startOfWeek },
      },
    }),
    db.task.findMany({
      where: { campaignId, deletedAt: null },
      select: {
        completed: true,
        completedAt: true,
        createdAt: true,
        dueDate: true,
        assignee: {
          select: { firstName: true, lastName: true },
        },
      },
    }),
  ]);

  const completedWithDates = allTasks.filter((t) => t.completed && t.completedAt);
  const avgDaysToCompletion =
    completedWithDates.length > 0
      ? (
          completedWithDates.reduce((sum, t) => {
            const days = (t.completedAt!.getTime() - t.createdAt.getTime()) / 86_400_000;
            return sum + days;
          }, 0) / completedWithDates.length
        ).toFixed(1)
      : "—";

  const assigneeMap = new Map<string, AssigneeRow>();
  for (const t of allTasks) {
    const name = t.assignee
      ? `${t.assignee.firstName} ${t.assignee.lastName}`
      : "Unassigned";
    if (!assigneeMap.has(name)) {
      assigneeMap.set(name, { name, open: 0, overdue: 0, completed: 0 });
    }
    const row = assigneeMap.get(name)!;
    if (t.completed) {
      row.completed++;
    } else {
      row.open++;
      if (t.dueDate && t.dueDate < now) row.overdue++;
    }
  }

  const assigneeRows = [...assigneeMap.values()].sort((a, b) => b.overdue - a.overdue);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Follow-up Status</h1>
        <p className="text-slate-500 text-sm mt-0.5">Open tasks, overdue items, and completion tracking</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          variant="hero"
          label="Open tasks"
          value={openCount.toLocaleString()}
          valueClassName={overdueCount > 0 ? "text-amber-600" : undefined}
        />
        {/* Overdue gets red treatment when non-zero */}
        {overdueCount > 0 ? (
          <div className="bg-red-50 rounded-2xl border border-red-200 px-5 py-4">
            <p className="text-xs font-medium text-red-400 uppercase tracking-wide mb-1">Overdue</p>
            <p className="text-2xl font-bold text-red-700 tabular-nums">{overdueCount.toLocaleString()}</p>
          </div>
        ) : (
          <StatCard label="Overdue" value="0" />
        )}
        <StatCard label="Completed this week" value={completedThisWeek.toLocaleString()} />
        <StatCard label="Avg days to complete" value={avgDaysToCompletion} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">By assignee</h2>
        </div>
        {assigneeRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No tasks recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Assignee</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Open</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Overdue</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {assigneeRows.map((row) => (
                <tr key={row.name}>
                  <td className="px-5 py-3 font-medium text-slate-700">{row.name}</td>
                  <td className="px-5 py-3 text-right text-slate-900 tabular-nums font-semibold">{row.open.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold">
                    <span className={row.overdue > 0 ? "text-red-600" : "text-slate-400"}>
                      {row.overdue.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-400 tabular-nums hidden sm:table-cell">{row.completed.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
