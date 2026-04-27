"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type {
  SupportTrendPoint,
  DoorsPerDayPoint,
  CanvasserPerfPoint,
  DistributionPoint,
} from "@/lib/analytics";

interface Props {
  supportTrend: SupportTrendPoint[];
  doorsPerDay: DoorsPerDayPoint[];
  canvasserPerf: CanvasserPerfPoint[];
  distribution: DistributionPoint[];
  totalResponses: number;
  totalCanvassedPeople: number;
}

const SUPPORT_COLORS: Record<string, string> = {
  strong_yes: "#10b981",
  soft_yes: "#34d399",
  undecided: "#f59e0b",
  soft_no: "#f97316",
  strong_no: "#ef4444",
};

const SUPPORT_LABELS: Record<string, string> = {
  strong_yes: "Strong Yes",
  soft_yes: "Soft Yes",
  undecided: "Undecided",
  soft_no: "Soft No",
  strong_no: "Strong No",
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

export function AnalyticsCharts({
  supportTrend,
  doorsPerDay,
  canvasserPerf,
  distribution,
  totalResponses,
  totalCanvassedPeople,
}: Props) {
  const hasData = totalResponses > 0;

  return (
    <div className="space-y-6">
      {/* Summary counts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Doors</span>
          <span className="text-3xl font-bold text-slate-900">{totalCanvassedPeople.toLocaleString()}</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Responses</span>
          <span className="text-3xl font-bold text-slate-900">{totalResponses.toLocaleString()}</span>
        </div>
      </div>

      {!hasData && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 text-sm">
          No canvass responses yet. Charts will appear once data is collected.
        </div>
      )}

      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Support level trend */}
          {supportTrend.length > 0 && (
            <ChartCard title="Support Level Trend">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={supportTrend.map((p) => ({ ...p, date: fmtDate(p.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  {(["strong_yes", "soft_yes", "undecided", "soft_no", "strong_no"] as const).map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={SUPPORT_LABELS[key]}
                      stroke={SUPPORT_COLORS[key]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Chart 2: Doors per day */}
          {doorsPerDay.length > 0 && (
            <ChartCard title="Doors Knocked Per Day">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={doorsPerDay.map((p) => ({ ...p, date: fmtDate(p.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="doors" name="Doors" fill="#1e293b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Chart 3: Canvasser performance */}
          {canvasserPerf.length > 0 && (
            <ChartCard title="Canvasser Performance (Distinct Doors)">
              <ResponsiveContainer width="100%" height={Math.max(180, canvasserPerf.length * 36)}>
                <BarChart
                  data={canvasserPerf}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} width={90} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Bar dataKey="doors" name="Doors" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Chart 4: Current support distribution */}
          {distribution.length > 0 && (
            <ChartCard title="Current Support Distribution">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {distribution.map((entry) => (
                      <Cell key={entry.level} fill={SUPPORT_COLORS[entry.level] ?? "#cbd5e1"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}
