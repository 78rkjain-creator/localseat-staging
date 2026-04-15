import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { CampaignPicker } from "./campaign-picker";
import type { Role } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Select Campaign" };

export default async function SelectCampaignPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Fetch memberships fresh from DB — never rely on JWT for this list,
  // since JWTs can be stale after reseeds or first-time logins.
  const memberships = await db.campaignMembership.findMany({
    where: { userId: session.user.id },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          wards: true,
          city: true,
          province: true,
          year: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ campaign: { year: "desc" } }, { campaign: { name: "asc" } }],
  });

  // If user somehow has no memberships, send them to login
  if (memberships.length === 0) {
    redirect("/login");
  }

  // If user has exactly one campaign and already has it active, skip this page
  if (memberships.length === 1 && session.user.activeCampaignId === memberships[0].campaign.id) {
    redirect("/dashboard");
  }

  const campaigns = memberships.map((m) => ({
    campaignId: m.campaign.id,
    campaignName: m.campaign.name,
    role: m.role as Role,
    wards: m.campaign.wards,
    city: m.campaign.city,
    province: m.campaign.province,
    year: m.campaign.year,
  }));

  const isMultiple = campaigns.length > 1;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8">
          <div className="h-11 w-11 rounded-2xl bg-brand-500 flex items-center justify-center mb-5">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isMultiple ? "Select a campaign" : "Enter campaign"}
          </h1>
          <p className="text-slate-500 mt-1.5">
            {isMultiple
              ? `You have access to ${campaigns.length} campaigns. Choose one to continue.`
              : `Select your campaign to continue.`}
          </p>
        </div>

        <CampaignPicker campaigns={campaigns} />
      </div>
    </div>
  );
}
