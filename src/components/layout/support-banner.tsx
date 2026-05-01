"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface SupportBannerProps {
  campaignName: string;
  mode: "readonly" | "full";
  expiresAt: Date | null;
}

function timeRemaining(expiresAt: Date): string {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

export function SupportBanner({ campaignName, mode, expiresAt }: SupportBannerProps) {
  const { update } = useSession();
  const router = useRouter();

  async function handleExit() {
    await update({ exitSupportMode: true });
    router.push("/admin/campaigns");
    router.refresh();
  }

  return (
    <div className="relative z-50 bg-slate-900 text-white text-sm flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-2 gap-4">
        {/* Left */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold tracking-wide uppercase flex-shrink-0">
            Support mode
          </span>
          <span className="text-white/80 truncate">
            Viewing <strong className="text-white">{campaignName}</strong>
          </span>
        </div>

        {/* Center — access level */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          {mode === "readonly" ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-200">
              Read-only
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
              Full access
              {expiresAt && ` · ${timeRemaining(expiresAt)}`}
            </span>
          )}
        </div>

        {/* Right */}
        <button
          onClick={handleExit}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 px-3 py-1.5 text-sm font-medium text-white transition-colors flex-shrink-0"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
