import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canCanvass, canManageCampaign } from "@/lib/permissions";
import { getGotvStats, getChaseList, getRideRequests, isGotvMode } from "@/lib/gotv";
import { GotvDashboard } from "./gotv-dashboard";
import { GotvSetup } from "./gotv-setup";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "GOTV — Election Day" };

export default async function GotvPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canCanvass(activeRole as Role)) redirect("/dashboard");

  const gotvEnabled = await isGotvMode(activeCampaignId);
  const isManager = canManageCampaign(activeRole as Role);

  if (!gotvEnabled) {
    if (isManager) {
      // Show setup screen to enable GOTV mode
      const campaign = await (await import("@/lib/db")).db.campaign.findUnique({
        where: { id: activeCampaignId },
        select: { voteTarget: true, electionDate: true, advanceVotingDates: true },
      });
      return (
        <GotvSetup
          voteTarget={campaign?.voteTarget ?? null}
          electionDate={campaign?.electionDate?.toISOString() ?? null}
          advanceVotingDates={campaign?.advanceVotingDates.map((d) => d.toISOString()) ?? []}
        />
      );
    }
    redirect("/dashboard");
  }

  const [stats, chaseListData, rideRequests] = await Promise.all([
    getGotvStats(activeCampaignId),
    getChaseList(activeCampaignId, { limit: 50 }),
    getRideRequests(activeCampaignId),
  ]);

  return (
    <GotvDashboard
      stats={stats}
      chaseList={chaseListData.people}
      chaseTotalCount={chaseListData.total}
      rideRequests={rideRequests.map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        phone: r.phoneMobile ?? r.phoneHome ?? null,
        votingPlanTime: r.votingPlanTime,
        address: r.household?.address
          ? [r.household.address.streetNumber, r.household.address.streetName]
              .filter(Boolean)
              .join(" ")
          : null,
      }))}
      isManager={isManager}
    />
  );
}
