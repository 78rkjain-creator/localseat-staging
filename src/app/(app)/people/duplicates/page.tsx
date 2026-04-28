import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageVoterList } from "@/lib/permissions";
import { DuplicatesUi } from "./duplicates-ui";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Duplicate Records" };

export default async function DuplicatesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canManageVoterList(activeRole as Role)) redirect("/people/residents");

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      <Link
        href="/people/residents"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Import & Data Management
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Duplicate Records</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Configure matching rules, search for duplicates, then merge or dismiss each group.
        </p>
      </div>

      <DuplicatesUi />
    </div>
  );
}
