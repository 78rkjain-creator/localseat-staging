import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewReports, canViewDonors, canViewVolunteers } from "@/lib/permissions";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Export Data" };

export default async function ExportDataPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewReports(activeRole as Role)) redirect("/dashboard");

  const role = activeRole as Role;
  const showDonors = canViewDonors(role);
  const showVolunteers = canViewVolunteers(role);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Export Data</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Download campaign data as CSV files
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <ExportCard
          title="People"
          description="All constituent records including contact info, support level, tags, touches count, and address."
          href="/people/export"
        />

        {showVolunteers && (
          <ExportCard
            title="Volunteers"
            description="Volunteer records with contact info and status."
            href="/api/volunteers/export"
          />
        )}

        {showDonors && (
          <ExportCard
            title="Donors"
            description="Donor prospects and tracking records."
            href="/api/donors/export"
          />
        )}

        <ExportCard
          title="Outreach History"
          description="All logged outreach interactions with dates, channels, and notes."
          href="/api/outreach/export-history"
        />
      </div>
    </div>
  );
}

function ExportCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>
      <a
        href={href}
        download
        className="flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
      >
        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download CSV
      </a>
    </div>
  );
}
