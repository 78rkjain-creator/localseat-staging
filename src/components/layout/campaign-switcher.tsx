"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface CampaignSwitcherProps {
  campaignName: string | null;
  campaignCount: number;
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    candidate: "Candidate",
    campaign_manager: "Campaign Manager",
    co_chair: "Co-Chair",
    field_organizer: "Field Organizer",
    canvasser: "Canvasser",
    volunteer_coordinator: "Volunteer Coordinator",
    finance_lead: "Finance Lead",
  };
  return labels[role] ?? role;
}

export function CampaignSwitcher({ campaignName, campaignCount }: CampaignSwitcherProps) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!campaignName) return null;

  const memberships = session?.user.memberships ?? [];
  const activeCampaignId = session?.user.activeCampaignId;

  async function switchTo(campaignId: string) {
    if (campaignId === activeCampaignId || switching) return;
    setSwitching(true);
    setOpen(false);
    await update({ activeCampaignId: campaignId });
    router.push("/dashboard");
    router.refresh();
    setSwitching(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 transition-colors max-w-full"
        title="Switch campaign"
      >
        <span className="truncate">{switching ? "Switching…" : campaignName}</span>
        <svg
          className={[
            "h-3 w-3 flex-shrink-0 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-50">
          <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 select-none">
            Campaigns
          </p>
          {memberships.map((m) => {
            const isActive = m.campaignId === activeCampaignId;
            return (
              <button
                key={m.campaignId}
                type="button"
                onClick={() => switchTo(m.campaignId)}
                disabled={isActive}
                className={[
                  "w-full flex items-start gap-2 px-3 py-2 text-left transition-colors",
                  isActive
                    ? "bg-brand-50 cursor-default"
                    : "hover:bg-slate-50 cursor-pointer",
                ].join(" ")}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className={[
                      "text-sm truncate leading-tight",
                      isActive
                        ? "font-semibold text-brand-700"
                        : "font-medium text-slate-700",
                    ].join(" ")}
                  >
                    {m.campaignName}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{roleLabel(m.role)}</p>
                </div>
                {isActive && (
                  <svg
                    className="h-3.5 w-3.5 text-brand-500 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
          <div className="h-px bg-slate-100 my-1" />
          <Link
            href="/onboarding/create-campaign"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <svg
              className="h-4 w-4 text-slate-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Start new campaign</span>
          </Link>
        </div>
      )}
    </div>
  );
}
