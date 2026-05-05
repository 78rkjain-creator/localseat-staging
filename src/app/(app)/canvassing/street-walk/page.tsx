import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/types";
import { StreetWalkScreen } from "./street-walk-screen";

const ALLOWED_ROLES: Role[] = [
  "canvasser",
  "field_organizer",
  "campaign_manager",
  "candidate",
  "data_manager",
];

export default async function StreetWalkPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    redirect("/canvassing");
  }

  const campaign = await db.campaign.findUnique({
    where: { id: activeCampaignId },
    select: { municipality: true, city: true, province: true },
  });

  const defaultCity = campaign?.municipality ?? campaign?.city ?? "";
  const defaultProvince = campaign?.province ?? "ON";

  return (
    <StreetWalkScreen
      defaultCity={defaultCity}
      defaultProvince={defaultProvince}
    />
  );
}
