"use client";

import { useEffect, useState } from "react";

interface CpuMetric { usagePct: number; }
interface MemoryMetric {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePct: number;
}
interface DiskMetric {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePct: number;
}
interface ProcessMetric {
  name: string;
  pid: number;
  status: string;
  cpuPct: number;
  memBytes: number;
  uptimeMs: number;
  restartCount: number;
}
interface MetricsPayload {
  timestamp: string;
  cpu: CpuMetric | null;
  memory: MemoryMetric | null;
  disk: DiskMetric | null;
  processes: ProcessMetric[];
}

const POLL_INTERVAL_MS = 30_000;

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(0)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUptime(ms: number): string {
  if (ms < 1000) return "<1s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

function pctColor(pct: number, warn = 75, critical = 90): string {
  if (pct >= critical) return "text-rose-700";
  if (pct >= warn) return "text-amber-700";
  return "text-slate-900";
}

function pctBarColor(pct: number, warn = 75, critical = 90): string {
  if (pct >= critical) return "bg-rose-500";
  if (pct >= warn) return "bg-amber-500";
  return "bg-emerald-500";
}

function MetricCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function GaugeCard({
  label,
  pct,
  detail,
}: {
  label: string;
  pct: number | null;
  detail: string;
}) {
  return (
    <MetricCard label={label}>
      {pct !== null ? (
        <>
          <p className={`text-3xl font-semibold tabular-nums ${pctColor(pct)}`}>
            {pct.toFixed(1)}<span className="text-base text-slate-400 ml-1">%</span>
          </p>
          <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pctBarColor(pct)}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">{detail}</p>
        </>
      ) : (
        <p className="text-sm text-slate-400">Unavailable</p>
      )}
    </MetricCard>
  );
}

export function SystemMetricsCards() {
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/system-metrics", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setError(`Request failed: ${res.status}`);
          return;
        }
        const json = (await res.json()) as MetricsPayload;
        if (cancelled) return;
        setData(json);
        setError(null);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      }
    }

    void load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error && !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <p className="text-sm text-rose-700">Could not load system metrics: {error}</p>
        <p className="text-xs text-slate-500 mt-1">
          Note: system metrics rely on /proc and shell tools that are only available on the VPS.
          On staging (Vercel) these will be unavailable.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <GaugeCard
          label="CPU"
          pct={data?.cpu?.usagePct ?? null}
          detail="Last 200 ms sample"
        />
        <GaugeCard
          label="Memory"
          pct={data?.memory?.usagePct ?? null}
          detail={
            data?.memory
              ? `${formatBytes(data.memory.usedBytes)} of ${formatBytes(data.memory.totalBytes)}`
              : ""
          }
        />
        <GaugeCard
          label="Disk (/)"
          pct={data?.disk?.usagePct ?? null}
          detail={
            data?.disk
              ? `${formatBytes(data.disk.usedBytes)} of ${formatBytes(data.disk.totalBytes)}`
              : ""
          }
        />
      </div>

      {data?.processes && data.processes.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">PM2 Processes</p>
          </div>
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">CPU</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Memory</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Uptime</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Restarts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.processes.map((p) => (
                <tr key={p.pid}>
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-700">{p.name}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        p.status === "online" ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          p.status === "online" ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-700 tabular-nums text-right">
                    {p.cpuPct.toFixed(0)}%
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-700 tabular-nums text-right">
                    {formatBytes(p.memBytes)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-700 tabular-nums text-right">
                    {formatUptime(p.uptimeMs)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-700 tabular-nums text-right">
                    {p.restartCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastUpdated && (
        <p className="text-xs text-slate-400 mt-3 text-right">
          Updated {lastUpdated} - refreshes every 30 seconds
        </p>
      )}
    </div>
  );
}
