import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

async function getPlatformStats() {
  const [
    totalCampaigns,
    totalUsers,
    totalCanvassResponses,
    totalDonors,
    totalPeople,
  ] = await Promise.all([
    db.campaign.count(),
    db.user.count(),
    db.canvassResponse.count(),
    db.donor.count(),
    db.person.count(),
  ]);

  return {
    totalCampaigns,
    totalUsers,
    totalCanvassResponses,
    totalDonors,
    totalPeople,
  };
}

interface StatCardProps {
  label: string;
  value: number;
  description: string;
}

function StatCard({ label, value, description }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900 tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user.platformRole) redirect("/dashboard");

  const stats = await getPlatformStats();

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Platform Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Counts include all records — active, inactive, and soft-deleted.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total Campaigns"
          value={stats.totalCampaigns}
          description="All campaigns ever created"
        />
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          description="All registered user accounts"
        />
        <StatCard
          label="Voter / People Records"
          value={stats.totalPeople}
          description="All constituent records across all campaigns"
        />
        <StatCard
          label="Canvass Responses"
          value={stats.totalCanvassResponses}
          description="All door-knock responses recorded"
        />
        <StatCard
          label="Donor Records"
          value={stats.totalDonors}
          description="All donor records across all campaigns"
        />
      </div>
    </div>
  );
}
