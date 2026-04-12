"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS } from "@/types";
import type { Role } from "@/types";

export default function SelectCampaignPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  if (!session) return null;

  const { memberships } = session.user;

  async function selectCampaign(campaignId: string) {
    await update({ activeCampaignId: campaignId });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Select a campaign
        </h1>
        <p className="text-slate-500 mb-6">
          You have access to multiple campaigns. Choose one to continue.
        </p>

        <div className="flex flex-col gap-3">
          {memberships.map((m) => (
            <button
              key={m.campaignId}
              onClick={() => selectCampaign(m.campaignId)}
              className="text-left"
            >
              <Card
                padding="md"
                className="hover:border-brand-300 hover:shadow-soft transition-all cursor-pointer"
              >
                <p className="font-semibold text-slate-900">{m.campaignName}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {ROLE_LABELS[m.role as Role]}
                </p>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
