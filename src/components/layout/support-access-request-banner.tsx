import {
  approveSupportAccessAction,
  denySupportAccessAction,
} from "@/app/(app)/campaign-settings/support-access/actions";

interface SupportAccessRequestBannerProps {
  grantId: string;
  requesterName: string;
  requestNote?: string | null;
  requestedAt?: Date;
}

export function SupportAccessRequestBanner({
  grantId,
  requesterName,
  requestNote,
  requestedAt,
}: SupportAccessRequestBannerProps) {
  const approve = approveSupportAccessAction.bind(null, grantId);
  const deny    = denySupportAccessAction.bind(null, grantId);

  return (
    <div className="relative z-40 bg-blue-600 text-white text-sm flex-shrink-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase flex-shrink-0">
              Support request
            </span>
            <span className="text-white/90 text-sm">
              <strong className="text-white">{requesterName}</strong> from the LocalSeat support team has requested temporary editing access to your campaign.
              {requestNote && (
                <span className="text-white/80"> Note: {requestNote}</span>
              )}
              {requestedAt && (
                <span className="text-white/60 text-xs ml-1">
                  {requestedAt.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                </span>
              )}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <form action={approve}>
            <button
              type="submit"
              className="h-8 px-3 rounded-lg bg-white text-blue-700 text-xs font-semibold hover:bg-blue-50 transition-colors"
            >
              Approve (72 hours)
            </button>
          </form>
          <form action={deny}>
            <button
              type="submit"
              className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
            >
              Deny
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
