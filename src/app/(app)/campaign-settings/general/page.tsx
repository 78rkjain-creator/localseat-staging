import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { GeneralSettingsForm } from "./general-settings-form";
import { SupportAccessSection } from "../support-access/support-access-section";
import type { Polygon, MultiPolygon } from "geojson";

export const metadata: Metadata = { title: "General Settings" };

export default async function GeneralSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole !== "candidate" && activeRole !== "campaign_manager" && activeRole !== "data_manager") redirect("/dashboard");

  const campaign = await db.campaign.findUnique({
    where: { id: activeCampaignId },
    select: {
      name: true,
      electionDate: true,
      fundraisingGoal: true,
      advanceVotingDates: true,
      officeAddressStreetNumber: true,
      officeAddressStreetName: true,
      officeAddressUnitNumber: true,
      officeAddressCity: true,
      officeAddressProvince: true,
      officeAddressPostalCode: true,
      officeAddressLat: true,
      officeAddressLng: true,
      municipalityName: true,
      municipalityId: true,
      municipalityBoundary: true,
    },
  });
  if (!campaign) redirect("/dashboard");

  const electionDateValue = campaign.electionDate
    ? campaign.electionDate.toISOString().split("T")[0]
    : "";

  // Serialize advance voting dates as { date: "YYYY-MM-DD", time: "HH:MM" }[] for the form
  const advanceVotingDates = [...campaign.advanceVotingDates]
    .sort((a, b) => a.getTime() - b.getTime())
    .map((d) => ({
      date: d.toISOString().slice(0, 10),
      time: d.toISOString().slice(11, 16),
    }));

  const hasOffice = !!campaign.officeAddressStreetName;
  const initialOfficeAddr = hasOffice
    ? {
        streetNumber: campaign.officeAddressStreetNumber ?? "",
        streetName:   campaign.officeAddressStreetName!,
        unitNumber:   campaign.officeAddressUnitNumber ?? "",
        city:         campaign.officeAddressCity ?? "",
        province:     campaign.officeAddressProvince ?? "",
        postalCode:   campaign.officeAddressPostalCode ?? "",
        lat:          campaign.officeAddressLat != null ? String(campaign.officeAddressLat) : "",
        lng:          campaign.officeAddressLng != null ? String(campaign.officeAddressLng) : "",
        addressId:    "",
      }
    : null;

  const streetLine = [
    campaign.officeAddressStreetNumber,
    campaign.officeAddressStreetName,
    campaign.officeAddressUnitNumber ? `#${campaign.officeAddressUnitNumber}` : null,
  ].filter(Boolean).join(" ");
  const initialOfficeDisplay = hasOffice
    ? [streetLine, campaign.officeAddressCity, campaign.officeAddressProvince, campaign.officeAddressPostalCode]
        .filter(Boolean).join(", ")
    : "";

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <Link
        href="/campaign-settings/ward"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Settings
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">General</h1>
        <p className="text-slate-500 text-sm mt-1">
          Core campaign details used across the platform.
        </p>
      </div>

      <GeneralSettingsForm
        name={campaign.name}
        electionDateValue={electionDateValue}
        fundraisingGoal={campaign.fundraisingGoal}
        advanceVotingDates={advanceVotingDates}
        initialOfficeAddr={initialOfficeAddr}
        initialOfficeDisplay={initialOfficeDisplay}
        initialMunicipalityName={campaign.municipalityName ?? null}
        initialMunicipalityId={campaign.municipalityId ?? null}
        initialMunicipalityBoundary={
          (campaign.municipalityBoundary as unknown as Polygon | MultiPolygon | null) ?? null
        }
      />

      {(activeRole === "candidate" || activeRole === "campaign_manager") && (
        <div className="mt-8">
          <SupportAccessSection campaignId={activeCampaignId} />
        </div>
      )}
    </div>
  );
}
