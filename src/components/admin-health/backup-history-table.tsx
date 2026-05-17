interface Run {
  id: string;
  startedAt: string;
  tier: string;
  filename: string;
  success: boolean;
  sizeBytes: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

interface Props {
  runs: Run[];
}

function formatSize(bytes: string | null): string {
  if (!bytes) return "-";
  const n = Number(bytes);
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function tierBadge(tier: string) {
  const palette: Record<string, { bg: string; text: string }> = {
    intraday: { bg: "bg-slate-100",  text: "text-slate-700" },
    daily:    { bg: "bg-sky-50",     text: "text-sky-700" },
    weekly:   { bg: "bg-violet-50",  text: "text-violet-700" },
    monthly:  { bg: "bg-amber-50",   text: "text-amber-700" },
  };
  const p = palette[tier] ?? { bg: "bg-slate-100", text: "text-slate-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize ${p.bg} ${p.text}`}>
      {tier}
    </span>
  );
}

export function BackupHistoryTable({ runs }: Props) {
  if (runs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <p className="text-sm text-slate-500">No backup runs recorded yet.</p>
        <p className="text-xs text-slate-400 mt-1">
          Backup runs are logged automatically after the 02:00 and 15:00 ET scheduled jobs.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Tier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Size</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Duration</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {runs.map((r) => (
              <tr key={r.id} className={r.success ? "" : "bg-rose-50/40"}>
                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{formatTime(r.startedAt)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{tierBadge(r.tier)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.success ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Success
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      Failed
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 tabular-nums text-right whitespace-nowrap">
                  {formatSize(r.sizeBytes)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 tabular-nums text-right whitespace-nowrap">
                  {formatDuration(r.durationMs)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-md truncate">
                  {r.success ? (
                    <span className="font-mono text-slate-400">{r.filename}</span>
                  ) : (
                    <span className="text-rose-700">{r.errorMessage ?? "(no error message)"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
