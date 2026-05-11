import { CanvassActivityFeed } from "@/components/dashboard/canvass-activity-feed";
import type { CanvassActivityEntry } from "@/lib/dashboard";

interface ActivityTabProps {
  liveActivity: CanvassActivityEntry[];
}

export function ActivityTab({ liveActivity }: ActivityTabProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white border border-slate-200 border-l-2 border-l-brand-300 rounded-xl overflow-hidden p-4">
        <CanvassActivityFeed initialEntries={liveActivity.slice(0, 15)} />
      </div>
    </div>
  );
}
