import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { CustomFieldsFormClient } from "./custom-fields-form-client";
import { isCustomFieldsEnabled } from "@/lib/plan-limits";
import { UpgradeCard } from "@/components/upgrade-card";
import { FEATURE_METADATA } from "@/lib/feature-metadata";
import type { CustomField } from "./actions";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Custom Fields" };

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "data_manager"];

export default async function CustomFieldsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) {
    redirect("/dashboard");
  }

  if (!await isCustomFieldsEnabled(activeCampaignId)) {
    const meta = FEATURE_METADATA["custom_fields"];
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

  const campaign = await db.campaign.findUnique({
    where: { id: activeCampaignId },
    select: { customFields: true },
  });
  if (!campaign) redirect("/dashboard");

  const initialFields = (campaign.customFields as CustomField[] | null) ?? [];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Custom Fields</h1>
        <p className="text-slate-500 text-sm mt-1 max-w-xl">
          Define up to 5 custom fields to track additional information for each resident.
          Labels appear on resident profiles and in CSV imports.
        </p>
      </div>

      <CustomFieldsFormClient initialFields={initialFields} />
    </div>
  );
}
