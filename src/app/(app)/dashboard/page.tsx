import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import type { Role } from "@/types";
import type { PlanTier } from "@/lib/plan-limits";

import { CandidateDashboard } from "./_candidate";
import { FieldOrganizerDashboard } from "./_field-organizer";
import { VolunteerCoordinatorDashboard } from "./_volunteer-coordinator";
import { FinanceLeadDashboard } from "./_finance-lead";
import { CanvasserHome } from "./_canvasser";
import { DemoWelcome } from "@/components/demo/demo-welcome";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole, firstName, id: userId } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  const role = activeRole as Role | null;

  if (!role) redirect("/select-campaign");

  const campaignRow = await db.campaign.findUnique({
    where: { id: activeCampaignId },
    select: { plan: true },
  });
  const plan = (campaignRow?.plan as PlanTier) ?? null;
  const demoMode = process.env.DEMO_MODE === "true";

  let dashboard: React.ReactNode;

  switch (role) {
    case "candidate":
    case "campaign_manager":
    case "data_manager":
    case "co_chair":
      dashboard = <CandidateDashboard campaignId={activeCampaignId} firstName={firstName} role={role} plan={plan} />;
      break;
    case "field_organizer":
      dashboard = <FieldOrganizerDashboard campaignId={activeCampaignId} firstName={firstName} userId={userId} />;
      break;
    case "canvasser":
      dashboard = <CanvasserHome userId={userId} campaignId={activeCampaignId} firstName={firstName} />;
      break;
    case "volunteer_coordinator":
      dashboard = <VolunteerCoordinatorDashboard campaignId={activeCampaignId} firstName={firstName} />;
      break;
    case "finance_lead":
      dashboard = <FinanceLeadDashboard campaignId={activeCampaignId} firstName={firstName} />;
      break;
    default:
      dashboard = <CandidateDashboard campaignId={activeCampaignId} firstName={firstName} role={role} plan={plan} />;
  }

  return (
    <>
      <DemoWelcome demoMode={demoMode} />
      {dashboard}
    </>
  );
}
