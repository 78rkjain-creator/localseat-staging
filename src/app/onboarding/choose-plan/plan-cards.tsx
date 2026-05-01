"use client";

import { useState } from "react";
import type { TierPricing } from "./actions";
import { selectPlanDev } from "./actions";
import type { PlanTier } from "@/lib/plan-limits";

// ── Feature list builder ───────────────────────────────────────────────────

function constituentText(limit: number): string {
  return limit === 0
    ? "Unlimited constituent records"
    : `Up to ${limit.toLocaleString()} constituent records`;
}

function canvasserText(limit: number): string {
  if (limit === 0) return "Unlimited canvassers";
  return `${limit.toLocaleString()} canvasser account${limit === 1 ? "" : "s"}`;
}

function getTierFeatures(tier: string, pricing: TierPricing): string[] {
  const { constituentLimit, canvasserLimit } = pricing;
  if (tier === "starter") {
    return [
      constituentText(constituentLimit),
      canvasserText(canvasserLimit),
      "Walk lists & turf assignment",
      "Mobile canvassing",
      "CSV export",
    ];
  }
  if (tier === "campaign") {
    return [
      constituentText(constituentLimit),
      canvasserText(canvasserLimit),
      "All Starter features",
      "Donor prospect tracking",
      "Follow-up queue",
      "Events & attendance tracking",
      "Custom fields",
      "Sign tracking",
      "Dashboard analytics",
    ];
  }
  // election
  return [
    constituentText(constituentLimit),
    canvasserText(canvasserLimit),
    "All Campaign features",
    "Surveys & digital signatures",
    "Priority support",
    "Onboarding call",
    "Data import assistance",
  ];
}

const TIERS: { key: PlanTier; popular?: boolean }[] = [
  { key: "starter"  },
  { key: "campaign", popular: true },
  { key: "election" },
];

// ── Checkmark ─────────────────────────────────────────────────────────────

function Check({ highlight }: { highlight?: boolean }) {
  return (
    <svg
      className={`h-4 w-4 flex-shrink-0 ${highlight ? "text-brand-500" : "text-emerald-500"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  campaignId: string;
  pricing: Record<string, TierPricing>;
  stripeEnabled: boolean;
}

// ── Main component ─────────────────────────────────────────────────────────

export function PlanCards({ campaignId, pricing, stripeEnabled }: Props) {
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  async function handleSelect(plan: PlanTier) {
    if (stripeEnabled) return; // Stripe path not yet wired
    setError(null);
    setSelecting(plan);

    const result = await selectPlanDev(campaignId, plan);

    if (result.error) {
      setError(result.error);
      setSelecting(null);
      return;
    }

    // Hard navigate so the session cookie is refreshed before the dashboard loads
    window.location.href = "/dashboard";
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      {/* Dev mode banner */}
      {!stripeEnabled && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">Development mode</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Plan selection is active without payment. Stripe will be connected before launch.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {TIERS.map(({ key, popular }) => {
          const info     = pricing[key] ?? { label: key, regularPrice: "—", salePrice: null, constituentLimit: 0, canvasserLimit: 0 };
          const features = getTierFeatures(key, info);
          const isLoading = selecting === key;
          const isDisabled = selecting !== null;

          return (
            <div
              key={key}
              className={[
                "relative bg-white rounded-3xl border-2 shadow-card flex flex-col p-7 transition-shadow",
                popular
                  ? "border-brand-500 shadow-brand-100"
                  : "border-slate-100 hover:border-slate-200",
              ].join(" ")}
            >
              {/* Most popular badge */}
              {popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-brand-500 text-white shadow-sm whitespace-nowrap">
                    Most popular
                  </span>
                </div>
              )}

              {/* Tier name + launch badge */}
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {info.label}
                </p>
                {info.salePrice && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 whitespace-nowrap">
                    Launch pricing
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="flex items-end gap-1.5 mb-1">
                <span className="text-4xl font-bold text-slate-900 tracking-tight leading-none">
                  ${info.salePrice ?? info.regularPrice}
                </span>
              </div>
              {info.salePrice && (
                <p className="text-sm text-slate-400 line-through mb-0.5">${info.regularPrice}</p>
              )}
              <p className="text-sm text-slate-400 mb-6">per campaign</p>

              {/* Feature list */}
              <ul className="flex flex-col gap-2.5 flex-1 mb-7">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check highlight={popular} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              {stripeEnabled ? (
                <button
                  disabled
                  className="w-full h-12 rounded-2xl text-sm font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
                >
                  Coming soon
                </button>
              ) : (
                <button
                  onClick={() => handleSelect(key)}
                  disabled={isDisabled}
                  className={[
                    "w-full h-12 rounded-2xl text-sm font-semibold transition-colors",
                    popular
                      ? "bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white disabled:opacity-60"
                      : "bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-white disabled:opacity-60",
                    isDisabled ? "cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  {isLoading ? "Setting up…" : "Select plan"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
