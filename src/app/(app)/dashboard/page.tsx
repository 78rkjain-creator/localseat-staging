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

  // If user has multiple campaigns and none is selected, show campaign picker
  if (!activeCampaignId) {
    redirect("/select-campaign");
  }

  // Fetch summary counts for the active campaign
  const [peopleCount, tasksCount, canvassListCount, pendingFollowUps] =
    await Promise.all([
      db.person.count({ where: { campaignId: activeCampaignId, deletedAt: null } }),
      db.task.count({ where: { campaignId: activeCampaignId, completed: false } }),
      db.canvassList.count({ where: { campaignId: activeCampaignId, deletedAt: null } }),
      db.task.count({
        where: { campaignId: activeCampaignId, completed: false, dueDate: { lte: new Date() } },
      }),
    ]);

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

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="People" value={peopleCount} />
        <MetricCard label="Walk lists" value={canvassListCount} />
        <MetricCard label="Open tasks" value={tasksCount} />
        <MetricCard
          label="Overdue"
          value={pendingFollowUps}
          highlight={pendingFollowUps > 0}
        />
      </div>

      {/* Placeholder sections — filled in subsequent build phases */}
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
      <p
        className={[
          "text-3xl font-bold",
          highlight ? "text-brand-500" : "text-slate-900",
        ].join(" ")}
      >
        {value.toLocaleString()}
      </p>
    </Card>
  );
}
