import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/types";

import { CandidateDashboard } from "./_candidate";
import { FieldOrganizerDashboard } from "./_field-organizer";
import { VolunteerCoordinatorDashboard } from "./_volunteer-coordinator";
import { FinanceLeadDashboard } from "./_finance-lead";
import { CanvasserHome } from "./_canvasser";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole, firstName, id: userId } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  const role = activeRole as Role | null;

  if (!role) redirect("/select-campaign");

  switch (role) {
    case "candidate":
    case "campaign_manager":
    case "co_chair":
      return <CandidateDashboard campaignId={activeCampaignId} firstName={firstName} role={role} />;

    case "field_organizer":
      return <FieldOrganizerDashboard campaignId={activeCampaignId} firstName={firstName} userId={userId} />;

    case "canvasser":
      return <CanvasserHome userId={userId} campaignId={activeCampaignId} firstName={firstName} />;

    case "volunteer_coordinator":
      return <VolunteerCoordinatorDashboard campaignId={activeCampaignId} firstName={firstName} />;

    case "finance_lead":
      return <FinanceLeadDashboard campaignId={activeCampaignId} firstName={firstName} />;

    default:
      // Fallback: show candidate-style dashboard for unknown roles
      return <CandidateDashboard campaignId={activeCampaignId} firstName={firstName} role={role} />;
  }
}
