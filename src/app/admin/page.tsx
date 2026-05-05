import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { isSuperAdmin } from "@/lib/permissions";

async function getPlatformStats() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    totalCampaigns,
    totalUsers,
    totalCanvassResponses,
    totalDonors,
    totalPeople,
    totalLeads,
    unemailedLeads,
    recentLeads,
    activePeople,
    geocodedPeople,
  ] = await Promise.all([
    db.campaign.count(),
    db.user.count(),
    db.canvassResponse.count(),
    db.donor.count(),
    db.person.count(),
    db.demoRegistration.count(),
    db.demoRegistration.count({ where: { emailedAt: null } }),
    db.demoRegistration.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.person.count({ where: { deletedAt: null, anonymizedAt: null } }),
    db.person.count({
      where: {
        deletedAt: null,
        anonymizedAt: null,
        household: {
          address: {
            lat: { not: null },
            lng: { not: null },
          },
        },
      },
    }),
  ]);

  const geocodedPct = activePeople > 0 ? Math.round((geocodedPeople / activePeople) * 100) : 0;

  return {
    totalCampaigns,
    totalUsers,
    totalCanvassResponses,
    totalDonors,
    totalPeople,
    totalLeads,
    unemailedLeads,
    recentLeads,
    activePeople,
    geocodedPeople,
    geocodedPct,
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
  const canSeeLeads = isSuperAdmin(session.user.platformRole);

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

      {canSeeLeads && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Geocoding Coverage
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Active People"
              value={stats.activePeople}
              description="Non-deleted, non-anonymized records"
            />
            <StatCard
              label="Geocoded"
              value={stats.geocodedPeople}
              description="Have a linked address with lat/lng"
            />
            <StatCard
              label="Coverage"
              value={stats.geocodedPct}
              description="% of active people geocoded"
            />
          </div>
        </div>
      )}

      {canSeeLeads && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Leads
          </h2>
          <Link
            href="/admin/demo-leads"
            className="block bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:border-brand-200 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <p className="text-sm font-semibold text-slate-700 group-hover:text-brand-600 transition-colors">
                Demo &amp; App Signups
              </p>
              <svg className="h-4 w-4 text-slate-300 group-hover:text-brand-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.totalLeads.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-0.5">Total leads</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600 tabular-nums">{stats.unemailedLeads.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-0.5">Not emailed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-brand-600 tabular-nums">{stats.recentLeads.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-0.5">Last 7 days</p>
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
