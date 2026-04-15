import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageVoterList } from "@/lib/permissions";
import { findDuplicatePairs } from "@/lib/people";
import { MergeUi } from "./merge-ui";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Duplicate Records" };

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canManageVoterList(activeRole as Role)) redirect("/voter-list");

  const pairs = await findDuplicatePairs(activeCampaignId);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      {/* Back */}
      <Link
        href="/voter-list"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Import & Data Management
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Duplicate Records</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {pairs.length === 0
            ? "No duplicates found"
            : `${pairs.length} potential duplicate pair${pairs.length !== 1 ? "s" : ""} found`}
          {pairs.length >= 50 && " (showing first 50)"}
        </p>
      </div>

      {pairs.length > 0 && (
        <div className="mb-6 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-600">
            Records are matched by <strong>first name + last name + street number + street name + postal code</strong> (case-insensitive).
            Choose which record to keep — the other will be soft-deleted and tagged <code className="bg-slate-200 px-1 rounded text-xs">record-outdated</code>.
            Tags from the removed record are transferred to the kept record.
          </p>
        </div>
      )}

      <MergeUi pairs={pairs} />
    </div>
  );
}
