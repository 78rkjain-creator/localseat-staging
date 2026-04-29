import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { TeamImportClient } from "./import-client";

export const metadata: Metadata = { title: "Import Team Members" };

const PERMITTED_ROLES = ["candidate", "campaign_manager", "co_chair", "field_organizer"] as const;
const FO_ALLOWED_NEW_ROLES = ["canvasser", "sign_installer"] as const;
const ALL_NEW_ROLES = [
  "candidate",
  "campaign_manager",
  "co_chair",
  "field_organizer",
  "canvasser",
  "volunteer_coordinator",
  "finance_lead",
  "sign_installer",
] as const;

type PermittedRole = (typeof PERMITTED_ROLES)[number];

export default async function TeamImportPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  if (!activeRole || !PERMITTED_ROLES.includes(activeRole as PermittedRole)) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold text-slate-900">Not authorized</h1>
        <p className="text-sm text-slate-500 mt-2">
          You don&apos;t have permission to import team members.
        </p>
      </main>
    );
  }

  const validRoles: string[] =
    activeRole === "field_organizer"
      ? [...FO_ALLOWED_NEW_ROLES]
      : [...ALL_NEW_ROLES];

  const tags = await db.tag.findMany({
    where: { campaignId: activeCampaignId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      <Link
        href="/import"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Import & Data Management
      </Link>

      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Import team members</h1>
        <p className="text-sm text-slate-500">
          Bulk-add canvassers, field organizers, and other campaign roles.
        </p>
      </header>

      <TeamImportClient
        validRoles={validRoles}
        existingTags={tags}
        requesterRole={activeRole}
      />
    </div>
  );
}
