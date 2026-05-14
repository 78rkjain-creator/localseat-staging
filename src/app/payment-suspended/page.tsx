import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/brand/Logo";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Account suspended — LocalSeat" };

export default async function PaymentSuspendedPage() {
  const session = await getServerSession(authOptions);

  // Check if user has other active campaigns they can switch to
  let hasOtherCampaigns = false;
  if (session?.user?.id) {
    const otherMemberships = await db.campaignMembership.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
        campaign: {
          deletedAt: null,
          paymentStatus: { notIn: ["suspended", "failed"] },
        },
      },
      select: { campaignId: true },
    });
    hasOtherCampaigns = otherMemberships.length > 0;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center gap-3">
          <Logo size={48} tone="ink" />
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <svg
              className="h-7 w-7 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
            Account suspended
          </h1>
          <p className="text-slate-500 text-sm mb-4">
            Your campaign has been suspended because payment was not received.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Your campaign data has not been deleted. Once payment is confirmed, your account will be reactivated automatically.
          </p>
          <p className="text-slate-500 text-sm mb-8">
            If you have questions, contact us at{" "}
            <a href="mailto:info@localseat.io" className="text-brand-500 hover:text-brand-600 font-medium">
              info@localseat.io
            </a>
          </p>

          <div className="flex flex-col gap-3">
            {hasOtherCampaigns && (
              <a
                href="/select-campaign"
                className="inline-flex w-full items-center justify-center h-12 rounded-2xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition-colors"
              >
                Switch to another campaign
              </a>
            )}
            <SignOutButton />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          LocalSeat — Built for Canadian municipal campaigns
        </p>
      </div>
    </div>
  );
}
