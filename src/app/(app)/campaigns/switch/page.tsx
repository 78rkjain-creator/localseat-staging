"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { SessionMembership } from "@/types";

export default function SwitchCampaignPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const memberships: SessionMembership[] = session?.user?.memberships ?? [];
  const activeCampaignId = session?.user?.activeCampaignId;

  // If only one campaign, switch to it and redirect immediately
  useEffect(() => {
    if (session && memberships.length === 1) {
      const only = memberships[0];
      if (activeCampaignId !== only.campaignId) {
        update({ activeCampaignId: only.campaignId }).then(() => {
          window.location.href = "/dashboard";
        });
      } else {
        router.replace("/dashboard");
      }
    }
  }, [session, memberships, activeCampaignId, update, router]);

  async function handleSwitch(campaignId: string) {
    await update({ activeCampaignId: campaignId });
    window.location.href = "/dashboard";
  }

  if (!session) {
    return null;
  }

  if (memberships.length === 1) {
    // Redirecting via useEffect above
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Redirecting&hellip;</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Switch campaign</h1>
        <p className="text-sm text-slate-500 mb-6">Select a campaign to continue.</p>

        <div className="flex flex-col gap-3">
          {memberships.map((m) => {
            const isActive = m.campaignId === activeCampaignId;
            return (
              <button
                key={m.campaignId}
                onClick={() => handleSwitch(m.campaignId)}
                className={[
                  "w-full text-left rounded-2xl border px-5 py-4 transition-colors",
                  isActive
                    ? "bg-brand-50 border-brand-200 ring-1 ring-brand-300"
                    : "bg-white border-slate-200 hover:border-brand-300 hover:bg-brand-50",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-slate-900">{m.campaignName}</p>
                <p className="text-xs text-slate-500 mt-0.5 capitalize">
                  {m.role.replace(/_/g, " ")}
                  {isActive && (
                    <span className="ml-2 text-brand-600 font-medium">Current</span>
                  )}
                </p>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => router.back()}
          className="mt-6 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
