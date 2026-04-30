import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessImportHub, canManageVoterList, canImportTeam } from "@/lib/permissions";
import { Users, UserPlus, GitMerge, ListChecks } from "lucide-react";
import type { Role } from "@/types";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Import & Data Management" };

export default async function ImportHubPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canAccessImportHub(activeRole as Role)) redirect("/dashboard");

  const role = activeRole as Role;
  const showVoterCards = canManageVoterList(role);
  const showTeamCard   = canImportTeam(role);

  const hasImports   = showVoterCards || showTeamCard;
  const hasDataTools = showVoterCards;

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Import & Data Management</h1>
        <p className="text-sm text-slate-500">
          Bulk-import data into your campaign and manage your records.
        </p>
      </header>

      {hasImports && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-700 uppercase tracking-wider">Imports</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {showVoterCards && (
              <ImportCard
                href="/import/voters"
                title="Voter list"
                description="Import contacts, voters, residents, or telephone lists into your campaign."
                icon={<Users className="h-6 w-6" />}
              />
            )}
            {showTeamCard && (
              <ImportCard
                href="/import/team"
                title="Team members & volunteers"
                description="Bulk-add canvassers, field organizers, volunteers, and other campaign roles."
                icon={<UserPlus className="h-6 w-6" />}
              />
            )}
          </div>
        </section>
      )}

      {hasDataTools && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-700 uppercase tracking-wider">Data tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ImportCard
              href="/people/duplicates"
              title="Duplicate detection"
              description="Find and merge possible duplicates in your people list."
              icon={<GitMerge className="h-6 w-6" />}
            />
            <ImportCard
              href="/import/voters/review"
              title="Review queue"
              description="Resolve flagged voter import rows that need follow-up."
              icon={<ListChecks className="h-6 w-6" />}
            />
          </div>
        </section>
      )}
    </main>
  );
}

function ImportCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-sm"
    >
      <div className="rounded-xl bg-brand-50 text-brand-600 p-2.5 inline-flex">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </Link>
  );
}
