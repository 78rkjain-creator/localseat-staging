import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canCanvass } from "@/lib/permissions";
import { isGotvMode } from "@/lib/gotv";
import { PollStrikeScreen } from "./poll-strike-screen";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Poll Strike" };

export default async function PollStrikePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canCanvass(activeRole as Role)) redirect("/dashboard");

  const gotvEnabled = await isGotvMode(activeCampaignId);
  if (!gotvEnabled) redirect("/gotv");

  return <PollStrikeScreen campaignId={activeCampaignId} />;
}
