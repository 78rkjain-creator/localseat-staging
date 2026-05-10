import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canCanvass } from "@/lib/permissions";
import { getLeaderboard, getCanvasserOfTheWeek, getMyEngagementStats } from "@/lib/engagement";
import { LeaderboardView } from "./leaderboard-view";
import type { Role } from "@prisma/client";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole, id: userId } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canCanvass(activeRole as Role)) redirect("/dashboard");

  const [leaderboard, myStats] = await Promise.all([
    getLeaderboard(activeCampaignId),
    getMyEngagementStats(userId, activeCampaignId),
  ]);

  const canvasserOfTheWeek = getCanvasserOfTheWeek(leaderboard);

  return (
    <LeaderboardView
      leaderboard={leaderboard}
      canvasserOfTheWeek={canvasserOfTheWeek}
      myStats={myStats}
      myUserId={userId}
    />
  );
}
