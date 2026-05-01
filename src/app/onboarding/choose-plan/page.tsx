import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTierPricing } from "./actions";
import { PlanCards } from "./plan-cards";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = { title: "Choose a plan — LocalSeat" };

export default async function ChoosePlanPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { campaignId: queryCampaignId } = await searchParams;

  const campaignId = queryCampaignId ?? session.user.activeCampaignId ?? null;
  if (!campaignId) redirect("/onboarding/create-campaign");

  const [pricing, campaign] = await Promise.all([
    getTierPricing(),
    db.campaign.findUnique({
      where:  { id: campaignId },
      select: { plan: true, planActivated: true, amountPaid: true },
    }),
  ]);

  const stripeEnabled = process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true";
  const currentAmountPaid =
    campaign?.planActivated && (campaign.amountPaid ?? 0) > 0
      ? (campaign.amountPaid ?? 0)
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-12">
      {/* Brand mark */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <Logo size={48} tone="ink" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">LocalSeat</h1>
          <p className="text-sm text-slate-500 mt-0.5">Municipal campaign platform</p>
        </div>
      </div>

      {/* Heading */}
      <div className="text-center mb-8 max-w-lg">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Choose a plan</h2>
        <p className="mt-2 text-base text-slate-500">
          Everything you need to run your campaign — pick the tier that fits your race.
        </p>
      </div>

      {/* Plan cards */}
      <PlanCards
        campaignId={campaignId}
        pricing={pricing}
        stripeEnabled={stripeEnabled}
        currentAmountPaid={currentAmountPaid}
      />

      <p className="mt-10 text-xs text-slate-400">
        LocalSeat &mdash; Built for Canadian municipal campaigns
      </p>
    </div>
  );
}
