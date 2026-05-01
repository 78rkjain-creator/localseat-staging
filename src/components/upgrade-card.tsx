import { db } from "@/lib/db";
import Link from "next/link";

interface UpgradeCardProps {
  featureName: string;
  featureDescription: string;
  requiredPlan: "campaign" | "election";
  campaignId: string;
}

export async function UpgradeCard({
  featureName,
  featureDescription,
  requiredPlan,
  campaignId,
}: UpgradeCardProps) {
  const [override, settings] = await Promise.all([
    db.campaignOverride.findUnique({
      where: { campaignId },
      select: { snapshotPricePaid: true },
    }),
    db.platformSettings.findMany({
      where: {
        key: {
          in: [
            `${requiredPlan}_regular_price`,
            `${requiredPlan}_sale_price`,
            `${requiredPlan}_label`,
          ],
        },
      },
    }),
  ]);

  const settingsMap = new Map(settings.map((r) => [r.key, r.value]));
  const planLabel =
    settingsMap.get(`${requiredPlan}_label`) ??
    (requiredPlan === "campaign" ? "Campaign" : "Election");

  const regularRaw = settingsMap.get(`${requiredPlan}_regular_price`);
  const saleRaw    = settingsMap.get(`${requiredPlan}_sale_price`);
  const planPrice  = parseInt(saleRaw ?? regularRaw ?? "0", 10);
  const pricePaid  = override?.snapshotPricePaid ?? 0;
  const upgradeCost = Math.max(0, planPrice - pricePaid);

  const fmt = (n: number) => `$${n.toLocaleString("en-CA")}`;

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl border-2 border-slate-100 shadow-card p-8 flex flex-col items-center text-center gap-6">
      {/* Lock icon */}
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100">
        <svg
          className="h-6 w-6 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>

      {/* Feature info */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-slate-900">{featureName}</h2>
        <p className="text-sm text-slate-500 leading-relaxed">{featureDescription}</p>
      </div>

      <div className="w-full border-t border-slate-100" />

      {/* Pricing breakdown */}
      <div className="w-full flex flex-col gap-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
          Available on the {planLabel} plan
        </p>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">You paid</span>
          <span className="font-semibold text-slate-700">
            {pricePaid > 0 ? fmt(pricePaid) : "—"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">{planLabel} plan</span>
          <span className="font-semibold text-slate-700">
            {planPrice > 0 ? fmt(planPrice) : "—"}
          </span>
        </div>
        <div className="flex justify-between text-sm border-t border-slate-100 pt-2 mt-1">
          <span className="font-semibold text-slate-700">Upgrade cost</span>
          <span className="font-bold text-slate-900">
            {upgradeCost === 0 ? "Included in your upgrade" : fmt(upgradeCost)}
          </span>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/onboarding/choose-plan`}
        className="w-full h-12 flex items-center justify-center rounded-2xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition-colors"
      >
        Upgrade to {planLabel}
      </Link>
    </div>
  );
}
