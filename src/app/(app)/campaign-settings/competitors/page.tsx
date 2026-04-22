import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCompetitors } from "@/lib/competitors";
import { CompetitorsClient } from "./competitors-client";

export const metadata: Metadata = { title: "Competitors" };

export default async function CompetitorsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole !== "candidate" && activeRole !== "campaign_manager") redirect("/dashboard");

  const competitors = await getCompetitors(activeCampaignId);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Competitors</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Other candidates in this race. Canvassers can identify supporters during door-knocking.
        </p>
      </div>
      <CompetitorsClient competitors={competitors} campaignId={activeCampaignId} />
    </div>
  );
}
