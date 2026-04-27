import type { ActivityEntry, ActivityType } from "@/lib/activity";

interface Props {
  entries: ActivityEntry[];
}

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function TypeIcon({ type }: { type: ActivityType }) {
  if (type === "canvass") {
    return (
      <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    );
  }
  if (type === "note") {
    return (
      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    );
  }
  // outreach
  return (
    <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

export function RecentActivityFeed({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-400">No recent activity.</p>
    );
  }

  return (
    <ol className="flex flex-col gap-0">
      {entries.map((entry, i) => (
        <li key={entry.id} className={["flex items-start gap-3 py-3", i > 0 ? "border-t border-slate-50" : ""].join(" ")}>
          {/* Icon */}
          <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <TypeIcon type={entry.type} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-800 leading-snug">{entry.description}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {entry.performedBy}
              <span className="mx-1.5 text-slate-300">·</span>
              {relativeTime(entry.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
