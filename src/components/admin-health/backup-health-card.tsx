interface LastSuccess {
  startedAt: string;
  tier: string;
  filename: string;
  sizeBytes: string | null;
  durationMs: number | null;
}

interface LastAttempt {
  startedAt: string;
  success: boolean;
  tier: string;
  errorMessage: string | null;
  errorCode: number | null;
}

interface Props {
  lastSuccess: LastSuccess | null;
  lastAttempt: LastAttempt | null;
  successCount30d: number;
  failCount30d: number;
}

function formatSize(bytes: string | null): string {
  if (!bytes) return "-";
  const n = Number(bytes);
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusBadge(state: "healthy" | "warning" | "critical" | "unknown") {
  const palette: Record<typeof state, { bg: string; text: string; label: string }> = {
    healthy:  { bg: "bg-emerald-50",  text: "text-emerald-700", label: "Healthy" },
    warning:  { bg: "bg-amber-50",    text: "text-amber-700",   label: "Warning" },
    critical: { bg: "bg-rose-50",     text: "text-rose-700",    label: "Critical" },
    unknown:  { bg: "bg-slate-100",   text: "text-slate-600",   label: "No data" },
  };
  const p = palette[state];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.bg} ${p.text}`}>
      {p.label}
    </span>
  );
}

export function BackupHealthCard({ lastSuccess, lastAttempt, successCount30d, failCount30d }: Props) {
  let overallState: "healthy" | "warning" | "critical" | "unknown" = "unknown";
  let stateNote = "";

  if (!lastSuccess) {
    overallState = "critical";
    stateNote = "No successful backup has been recorded yet.";
  } else {
    const ageHours = (Date.now() - new Date(lastSuccess.startedAt).getTime()) / 3_600_000;
    if (ageHours > 49) {
      overallState = "critical";
      stateNote = `Last successful backup was ${Math.floor(ageHours)} hours ago — investigate.`;
    } else if (ageHours > 25) {
      overallState = "warning";
      stateNote = `Last successful backup was ${Math.floor(ageHours)} hours ago — should be more recent.`;
    } else {
      overallState = "healthy";
      stateNote = "Backups are running on schedule.";
    }
  }

  const lastAttemptFailed = lastAttempt && !lastAttempt.success;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-sm font-medium text-slate-500">Backup status</p>
          <div className="mt-2 flex items-center gap-3">
            {statusBadge(overallState)}
            <span className="text-sm text-slate-600">{stateNote}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Last successful</p>
          {lastSuccess ? (
            <>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {formatRelative(lastSuccess.startedAt)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{formatAbsolute(lastSuccess.startedAt)}</p>
            </>
          ) : (
            <p className="mt-1 text-base text-slate-400">No record</p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Last tier</p>
          <p className="mt-1 text-base font-semibold text-slate-900 capitalize">
            {lastSuccess?.tier ?? "-"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {lastSuccess?.sizeBytes ? formatSize(lastSuccess.sizeBytes) : "-"}
            {lastSuccess?.durationMs !== undefined && lastSuccess?.durationMs !== null
              ? ` in ${formatDuration(lastSuccess.durationMs)}`
              : ""}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">30-day success</p>
          <p className="mt-1 text-base font-semibold text-emerald-700 tabular-nums">
            {successCount30d}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">runs completed</p>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">30-day failures</p>
          <p className={`mt-1 text-base font-semibold tabular-nums ${failCount30d > 0 ? "text-rose-700" : "text-slate-400"}`}>
            {failCount30d}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">runs failed</p>
        </div>
      </div>

      {lastAttemptFailed && lastAttempt && (
        <div className="mt-5 rounded-xl bg-rose-50 border border-rose-100 p-4">
          <p className="text-sm font-medium text-rose-800">Last attempt failed</p>
          <p className="mt-1 text-xs text-rose-700">
            {formatAbsolute(lastAttempt.startedAt)} — Tier: <span className="capitalize">{lastAttempt.tier}</span>
            {lastAttempt.errorCode !== null ? ` — Exit code ${lastAttempt.errorCode}` : ""}
          </p>
          {lastAttempt.errorMessage && (
            <p className="mt-2 text-xs text-rose-700 font-mono break-words">
              {lastAttempt.errorMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
