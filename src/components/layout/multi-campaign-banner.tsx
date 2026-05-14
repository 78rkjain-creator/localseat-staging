"use client";

import { useState } from "react";

interface MultiCampaignBannerProps {
  campaignCount: number;
  currentCampaignName: string;
}

export function MultiCampaignBanner({ campaignCount, currentCampaignName }: MultiCampaignBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <svg
          className="h-4 w-4 text-blue-500 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
        <p className="text-sm text-blue-800">
          You have access to <strong>{campaignCount} campaigns</strong>.
          You&apos;re viewing <strong>{currentCampaignName}</strong>.
          To switch, click your campaign name in the sidebar.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
