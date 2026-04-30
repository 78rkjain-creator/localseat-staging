import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReportsFormClient } from "./reports-form-client";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Email Reports" };

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "data_manager", "co_chair"];

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    redirect("/dashboard");
  }

  const campaign = await db.campaign.findUnique({
    where: { id: activeCampaignId },
    select: { dailySummaryEnabled: true, dailySummaryEmail: true },
  });
  if (!campaign) redirect("/dashboard");

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Email Reports</h1>
        <p className="text-slate-500 text-sm mt-1 max-w-xl">
          Configure automated daily summaries for your campaign team.
        </p>
      </div>

      <ReportsFormClient
        dailySummaryEnabled={campaign.dailySummaryEnabled}
        dailySummaryEmail={campaign.dailySummaryEmail}
      />
    </div>
  );
}
