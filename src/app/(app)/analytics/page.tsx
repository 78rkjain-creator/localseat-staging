import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAnalyticsData } from "@/lib/analytics";
import { isAnalyticsEnabled } from "@/lib/plan-limits";
import { AnalyticsCharts } from "./analytics-charts";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Analytics" };

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "data_manager", "co_chair"];

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    redirect("/dashboard");
  }

  if (!await isAnalyticsEnabled(activeCampaignId)) redirect("/dashboard");

  const data = await getAnalyticsData(activeCampaignId);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">
          Canvassing progress and support breakdown for your campaign.
        </p>
      </div>

      <AnalyticsCharts
        supportTrend={data.supportTrend}
        doorsPerDay={data.doorsPerDay}
        canvasserPerf={data.canvasserPerf}
        distribution={data.distribution}
        totalResponses={data.totalResponses}
        totalCanvassedPeople={data.totalCanvassedPeople}
      />
    </div>
  );
}
