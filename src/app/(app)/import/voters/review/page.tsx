import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReviewQueueClient } from "./review-queue-client";
import { BackLink } from "@/components/ui/back-link";

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
      <BackLink fallbackHref="/import/voters" label="Back to Voter list" />

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
