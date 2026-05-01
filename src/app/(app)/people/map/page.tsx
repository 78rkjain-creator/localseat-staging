import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCampaignMapPeople } from "@/lib/map";
import { CampaignMapClient } from "./campaign-map";
import { isContactMapEnabled } from "@/lib/plan-limits";
import { UpgradeCard } from "@/components/upgrade-card";
import { FEATURE_METADATA } from "@/lib/feature-metadata";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Contact Map" };

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "data_manager", "co_chair", "field_organizer"];
const CAN_CREATE_ROLES: Role[] = ["candidate", "campaign_manager", "data_manager", "field_organizer"];

export default async function ContactMapPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    redirect("/dashboard");
  }

  if (!await isContactMapEnabled(activeCampaignId)) {
    const meta = FEATURE_METADATA["contact_map"];
    return (
      <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
        <UpgradeCard
          featureName={meta.name}
          featureDescription={meta.description}
          requiredPlan={meta.requiredPlan}
          campaignId={activeCampaignId}
        />
      </div>
    );
  }

  const canCreate = CAN_CREATE_ROLES.includes(activeRole as Role);

  const { features, wardBoundary, totalCount } = await getCampaignMapPeople(activeCampaignId);

  if (features.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-12 max-w-lg mx-auto text-center">
        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">No geocoded addresses yet</h2>
        <p className="text-sm text-slate-500">
          Addresses need latitude and longitude coordinates before they appear on the map. Geocode addresses after importing voter data.
        </p>
      </div>
    );
  }

  return (
    <CampaignMapClient
      features={features}
      wardBoundary={wardBoundary}
      campaignId={activeCampaignId}
      totalCount={totalCount}
      canCreate={canCreate}
    />
  );
}
