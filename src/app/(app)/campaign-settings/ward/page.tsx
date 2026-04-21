import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { WardMapClient } from "./WardMapClient";
import type { Polygon } from "geojson";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Ward boundary" };

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "co_chair"];

export default async function WardBoundaryPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    redirect("/dashboard");
  }

  const campaign = await db.campaign.findUnique({
    where: { id: activeCampaignId },
    select: { wardBoundary: true, wardBoundarySetAt: true },
  });

  if (!campaign) redirect("/dashboard");

  const wardBoundary =
    campaign.wardBoundary !== null
      ? (campaign.wardBoundary as unknown as Polygon)
      : null;

  const wardBoundarySetAt = campaign.wardBoundarySetAt
    ? campaign.wardBoundarySetAt.toISOString()
    : null;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ward boundary</h1>
        <p className="text-slate-500 text-sm mt-1 max-w-xl">
          Draw your ward boundary on the map or upload a GeoJSON or KML file.
          Voters imported outside this boundary will be flagged for review.
        </p>
      </div>

      <WardMapClient
        wardBoundary={wardBoundary}
        wardBoundarySetAt={wardBoundarySetAt}
      />
    </div>
  );
}
