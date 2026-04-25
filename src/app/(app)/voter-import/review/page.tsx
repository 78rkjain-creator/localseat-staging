import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReviewQueueClient } from "./ReviewQueueClient";

export const metadata: Metadata = { title: "Review Queue" };

export default async function ReviewQueuePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  const allowed = ["candidate", "campaign_manager", "co_chair"];
  if (!activeRole || !allowed.includes(activeRole)) redirect("/dashboard");

  const pendingMemberships = await db.personListMembership.findMany({
    where: { campaignId: activeCampaignId, status: "pending_review" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reviewReason: true,
      listImportId: true,
      listImport: {
        select: { id: true, name: true, importedAt: true },
      },
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          household: {
            select: {
              address: {
                select: {
                  streetNumber: true,
                  streetName: true,
                  unitNumber: true,
                  city: true,
                  province: true,
                  postalCode: true,
                },
              },
            },
          },
        },
      },
    },
  });

  type PendingRow = (typeof pendingMemberships)[number];

  // Group by listImport
  const groupMap = new Map<string, {
    importId: string;
    importName: string;
    importedAt: Date;
    memberships: PendingRow[];
  }>();

  for (const m of pendingMemberships) {
    const { id, name, importedAt } = m.listImport;
    if (!groupMap.has(id)) {
      groupMap.set(id, { importId: id, importName: name, importedAt, memberships: [] });
    }
    groupMap.get(id)!.memberships.push(m);
  }

  const groups = [...groupMap.values()];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <Link
        href="/voter-import"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Import & Data Management
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Review Queue</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Partial matches from Official Voters List imports that need your review.
        </p>
      </div>

      <ReviewQueueClient groups={groups} />
    </div>
  );
}
