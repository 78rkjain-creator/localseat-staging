"use client";

import Link from "next/link";

interface CampaignSwitcherProps {
  campaignName: string | null;
  campaignCount: number;
}

export function CampaignSwitcher({ campaignName, campaignCount }: CampaignSwitcherProps) {
  if (!campaignName) return null;

  if (campaignCount > 1) {
    return (
      <Link
        href="/campaigns/switch"
        className="text-xs text-slate-500 truncate hover:text-brand-600 transition-colors"
        title="Switch campaign"
      >
        {campaignName}
        <span className="ml-1 text-slate-400">↕</span>
      </Link>
    );
  }

  return (
    <p className="text-xs text-slate-500 truncate">{campaignName}</p>
  );
}
