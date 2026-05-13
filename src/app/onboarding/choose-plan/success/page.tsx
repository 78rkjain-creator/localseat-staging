import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { Logo } from "@/components/brand/Logo";
import { SuccessActions } from "./success-actions";

export const metadata: Metadata = { title: "Plan activated — LocalSeat" };

const PLAN_LABELS: Record<string, string> = {
  bench:  "Bench",
  chair:  "Chair",
  podium: "Podium",
  stage:  "Stage",
  arena:  "Arena",
};

export default async function PlanSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  if (!session_id) redirect("/onboarding/choose-plan");

  let sessionData: Stripe.Checkout.Session | null = null;
  try {
    sessionData = await getStripe().checkout.sessions.retrieve(session_id);
  } catch {
    redirect("/onboarding/choose-plan");
  }

  if (!sessionData || sessionData.payment_status !== "paid") {
    redirect("/onboarding/choose-plan");
  }

  const plan = sessionData.metadata?.plan ?? "";
  const amountTotal = sessionData.amount_total ?? 0;
  const amountDollars = Math.round(amountTotal / 100);
  const planLabel = PLAN_LABELS[plan] ?? plan;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <Logo size={48} tone="ink" />
        </div>

        {/* Success card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-8 text-center">
          {/* Green check */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <svg
              className="h-7 w-7 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
            You&rsquo;re on {planLabel}
          </h1>
          <p className="text-slate-500 text-sm mb-1">
            Payment of <span className="font-semibold text-slate-700">${amountDollars} CAD</span> confirmed.
          </p>
          <p className="text-slate-400 text-sm mb-8">
            Your campaign is now active. Head to your dashboard to get started.
          </p>

          {/* Client component handles session refresh then navigates */}
          <SuccessActions />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          A receipt has been sent to your email by Stripe.
        </p>
      </div>
    </div>
  );
}
