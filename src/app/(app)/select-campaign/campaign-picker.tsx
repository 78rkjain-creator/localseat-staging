"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { Role } from "@/types";
import { ROLE_LABELS } from "@/types";

interface Campaign {
  campaignId: string;
  campaignName: string;
  role: Role;
  wards: string[];
  city: string;
  province: string;
  year: number;
}

interface Props {
  campaigns: Campaign[];
}

export function CampaignPicker({ campaigns }: Props) {
  const { update } = useSession();
  const router = useRouter();
  const [selecting, setSelecting] = useState<string | null>(null);

  async function selectCampaign(campaignId: string) {
    setSelecting(campaignId);
    await update({ activeCampaignId: campaignId });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {campaigns.map((c) => (
        <button
          key={c.campaignId}
          onClick={() => selectCampaign(c.campaignId)}
          disabled={selecting !== null}
          className="text-left group"
        >
          <div
            className={[
              "bg-white rounded-3xl border px-5 py-4 shadow-sm transition-all",
              selecting === c.campaignId
                ? "border-brand-300 shadow-md opacity-75"
                : "border-slate-100 hover:border-brand-200 hover:shadow-md",
              selecting !== null && selecting !== c.campaignId
                ? "opacity-50"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 leading-snug">
                  {c.campaignName}
                </p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {c.city}, {c.province} &middot; {c.year}
                  {c.wards?.length ? ` · ${c.wards.join(", ")}` : ""}
                </p>
                <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200">
                  {ROLE_LABELS[c.role]}
                </span>
              </div>
              <div
                className={[
                  "flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center transition-colors mt-0.5",
                  selecting === c.campaignId
                    ? "bg-brand-500"
                    : "bg-slate-100 group-hover:bg-brand-50",
                ].join(" ")}
              >
                {selecting === c.campaignId ? (
                  <svg
                    className="h-4 w-4 text-white animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4 text-slate-400 group-hover:text-brand-500 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
