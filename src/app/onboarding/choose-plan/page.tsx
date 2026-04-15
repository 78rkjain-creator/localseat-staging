import type { Metadata } from "next";

export const metadata: Metadata = { title: "Choose a plan — LocalSeat" };

const FEATURES = [
  "Unlimited canvassers",
  "Walk lists and turf assignment",
  "Donor and volunteer tracking",
  "Mobile canvassing app",
  "CSV exports",
];

export default function ChoosePlanPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand-500 flex items-center justify-center shadow-soft">
          <svg
            className="h-7 w-7 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            LocalSeat
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Municipal campaign platform</p>
        </div>
      </div>

      {/* Plan card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-card border border-slate-100 p-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-1">Choose a plan</h2>
        <p className="text-sm text-slate-500 mb-6">
          Get started with everything you need to run your campaign.
        </p>

        {/* Plan tile */}
        <div className="rounded-2xl border-2 border-brand-500 bg-brand-50 px-5 py-4 mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-base font-bold text-slate-900">Campaign Starter</span>
            <span className="text-xs font-semibold text-brand-700 bg-brand-100 border border-brand-200 rounded-full px-2.5 py-0.5">
              Free during beta
            </span>
          </div>

          <ul className="mt-3 space-y-2">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2.5 text-sm text-slate-700">
                <svg
                  className="h-4 w-4 text-brand-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-400 text-center mb-5">
          Payment will be collected here in a future update.
        </p>

        <a
          href="/onboarding/create-campaign"
          className="flex items-center justify-center w-full h-12 rounded-2xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold text-sm transition-colors"
        >
          Continue — set up your campaign
        </a>
      </div>

      <p className="mt-8 text-xs text-slate-400">
        LocalSeat &mdash; Built for Canadian municipal campaigns
      </p>
    </div>
  );
}
