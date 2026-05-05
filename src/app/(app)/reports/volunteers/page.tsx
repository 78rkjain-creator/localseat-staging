import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewReports } from "@/lib/permissions";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Volunteer Summary" };

function pct(n: number, d: number) {
  if (d === 0) return "0%";
  return `${Math.round((n / d) * 100)}%`;
}

export default async function VolunteerSummaryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewReports(activeRole as Role)) redirect("/dashboard");

  const campaignId = activeCampaignId;

  const volunteers = await db.person.findMany({
    where: {
      campaignId,
      deletedAt: null,
      anonymizedAt: null,
      volunteerRecords: { some: { deletedAt: null } },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phoneMobile: true,
      phoneHome: true,
      availability: true,
      tags: { include: { tag: true } },
      outreachLogs: {
        where: { deletedAt: null },
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const total = volunteers.length;
  const contacted = volunteers.filter((v) => v.outreachLogs.length > 0).length;
  const withAvailability = volunteers.filter((v) => v.availability).length;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Volunteer Summary</h1>
        <p className="text-slate-500 text-sm mt-0.5">People who have expressed volunteer interest</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard variant="hero" label="Total volunteers" value={total.toLocaleString()} />
        <StatCard label="Contacted" value={contacted.toLocaleString()} sub={pct(contacted, total)} />
        <StatCard label="With availability" value={withAvailability.toLocaleString()} sub={pct(withAvailability, total)} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Volunteer list</h2>
        </div>
        {volunteers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No volunteers recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Phone</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Availability</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Last contacted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {volunteers.map((v) => {
                const phone = v.phoneMobile ?? v.phoneHome;
                const lastContact = v.outreachLogs[0]?.date;
                const tags = v.tags.map(({ tag }) => tag.name).join(", ");
                return (
                  <tr key={v.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{v.firstName} {v.lastName}</p>
                      {tags && <p className="text-xs text-slate-400 mt-0.5">{tags}</p>}
                    </td>
                    <td className="px-5 py-3 text-slate-500 hidden sm:table-cell">{phone ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-500 hidden md:table-cell">{v.availability ?? "—"}</td>
                    <td className="px-5 py-3 text-right text-slate-400 tabular-nums hidden sm:table-cell">
                      {lastContact ? lastContact.toLocaleDateString("en-CA") : "Not contacted"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
