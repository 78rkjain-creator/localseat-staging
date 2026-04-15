"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_LABELS } from "@/types";
import type { Role } from "@/types";

export default function MyCampaignsPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);

  if (!session) return null;

  const { memberships, activeCampaignId } = session.user;

  async function handleSwitch(campaignId: string) {
    setSwitching(campaignId);
    await update({ activeCampaignId: campaignId });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Your campaigns</h1>

      <div className="space-y-3">
        {memberships.map((m) => {
          const isActive = m.campaignId === activeCampaignId;
          return (
            <div
              key={m.campaignId}
              className={[
                "bg-white rounded-2xl border px-5 py-4 flex items-center gap-4 transition-all",
                isActive
                  ? "border-brand-300 shadow-sm"
                  : "border-slate-200",
              ].join(" ")}
            >
              {/* Active indicator dot */}
              <div className={[
                "h-2.5 w-2.5 rounded-full flex-shrink-0",
                isActive ? "bg-brand-500" : "bg-slate-200",
              ].join(" ")} />

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 leading-snug truncate">
                  {m.campaignName}
                </p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {ROLE_LABELS[m.role as Role]}
                  {isActive && (
                    <span className="ml-2 text-xs font-medium text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-2 py-0.5">
                      Active
                    </span>
                  )}
                </p>
              </div>

              {!isActive && (
                <button
                  onClick={() => handleSwitch(m.campaignId)}
                  disabled={switching !== null}
                  className="flex-shrink-0 h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  {switching === m.campaignId ? "Switching…" : "Switch"}
                </button>
              )}
            </div>
          );
        })}

        {memberships.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 px-5 py-8 text-center">
            <p className="text-slate-500 text-sm">You are not a member of any campaigns yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
