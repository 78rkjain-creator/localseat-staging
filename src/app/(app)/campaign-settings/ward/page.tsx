import type { Metadata } from "next";
import Link from "next/link";
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

  const [campaign, flaggedCount] = await Promise.all([
    db.campaign.findUnique({
      where: { id: activeCampaignId },
      select: { wardBoundary: true, wardBoundarySetAt: true },
    }),
    db.person.count({
      where: {
        campaignId: activeCampaignId,
        deletedAt: null,
        wardStatus: { in: ["outside", "pending_review"] },
      },
    }),
  ]);

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

      {flaggedCount > 0 && (
        <div className="mt-6 flex items-start justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <svg className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm text-amber-800">
              <strong>{flaggedCount}</strong>{" "}
              voter{flaggedCount !== 1 ? "s" : ""} are outside your ward boundary and need review.
            </p>
          </div>
          <Link
            href="/campaign-settings/ward/review"
            className="flex-shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 whitespace-nowrap transition-colors"
          >
            Review now
          </Link>
        </div>
      )}
    </div>
  );
}
