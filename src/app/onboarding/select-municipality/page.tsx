import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/brand/Logo";
import { MunicipalityStep } from "./municipality-step";
import type { Polygon, MultiPolygon } from "geojson";

export const metadata: Metadata = { title: "Select municipality — LocalSeat" };

export default async function SelectMunicipalityPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string; required?: string; next?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { campaignId: queryCampaignId, required: requiredParam, next: nextParam } = await searchParams;
  const campaignId = queryCampaignId ?? session.user.activeCampaignId ?? null;
  if (!campaignId) redirect("/onboarding/create-campaign");

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      name: true,
      municipalityName: true,
      municipalityId: true,
      municipalityBoundary: true,
    },
  });
  if (!campaign) redirect("/dashboard");

  const required = requiredParam === "true" || requiredParam === "force";

  // Compute the post-save redirect URL
  const nextUrl = nextParam === "choose-plan"
    ? `/onboarding/choose-plan?campaignId=${campaignId}`
    : "/dashboard";

  // Pre-populate from existing campaign data
  const initialMunicipality = campaign.municipalityName
    ? { id: campaign.municipalityId ?? null, name: campaign.municipalityName }
    : null;

  const initialBoundary =
    (campaign.municipalityBoundary as unknown as Polygon | MultiPolygon | null) ?? null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-12">
      <div className="mb-10">
        <Logo />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Select your municipality</h1>
          <p className="text-sm text-slate-500 mt-2">
            Choose the Ontario municipality where{" "}
            <span className="font-medium text-slate-700">{campaign.name}</span> is running.
            {!required && " You can set this later in campaign settings."}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <MunicipalityStep
            campaignId={campaignId}
            required={required}
            nextUrl={nextUrl}
            initialMunicipality={initialMunicipality}
            initialBoundary={initialBoundary}
          />
        </div>
      </div>
    </div>
  );
}
