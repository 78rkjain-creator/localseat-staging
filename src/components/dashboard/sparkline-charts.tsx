"use client";

import {
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export type SeriesPoint = { date: string; count: number };

function dayLabel(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en", { weekday: "short" }).slice(0, 3);
}

// Format Y-axis ticks — keeps it compact (e.g. 1.2k instead of 1200)
function formatYTick(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

// Simple tooltip for hover
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.[0]) return null;
  const dateLabel = label ? dayLabel(label) : "";
  return (
    <div className="bg-slate-800 text-white text-[11px] px-2 py-1 rounded shadow-lg">
      <span className="font-medium">{payload[0].value.toLocaleString()}</span>
      {dateLabel && <span className="text-white/60 ml-1">{dateLabel}</span>}
    </div>
  );
}

// ── Bar sparkline ──────────────────────────────────────────────────────────

interface BarSparklineProps {
  data: SeriesPoint[];
  height?: number;
  showAxes?: boolean;
  yLabel?: string;
}

export function BarSparkline({ data, height = 64, showAxes = true, yLabel }: BarSparklineProps) {
  const maxVal = Math.max(...data.map((d) => d.count), 1);

  return (
    <div>
      {yLabel && (
        <p className="text-[10px] text-slate-400 mb-1">{yLabel}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={showAxes ? { top: 4, right: 4, bottom: 0, left: -12 } : { top: 2, right: 0, bottom: 0, left: 0 }}
          barCategoryGap="20%"
        >
          {showAxes && (
            <XAxis
              dataKey="date"
              tickFormatter={dayLabel}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
              dy={4}
            />
          )}
          {showAxes && (
            <YAxis
              tickFormatter={formatYTick}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              width={32}
              domain={[0, (max: number) => Math.ceil(max * 1.1)]}
              allowDecimals={false}
              tickCount={4}
            />
          )}
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === data.length - 1 ? "#f97316" : "rgba(148,163,184,0.35)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Line / area sparkline ──────────────────────────────────────────────────

interface LineSparklineProps {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  showAxes?: boolean;
  yLabel?: string;
  ySuffix?: string;
}

export function LineSparkline({
  data,
  color = "#22c55e",
  height = 64,
  showAxes = true,
  yLabel,
  ySuffix = "",
}: LineSparklineProps) {
  return (
    <div>
      {yLabel && (
        <p className="text-[10px] text-slate-400 mb-1">{yLabel}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={showAxes ? { top: 4, right: 4, bottom: 0, left: -12 } : { top: 2, right: 0, bottom: 0, left: 0 }}
        >
          {showAxes && (
            <XAxis
              dataKey="date"
              tickFormatter={dayLabel}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
              dy={4}
            />
          )}
          {showAxes && (
            <YAxis
              tickFormatter={(v: number) => `${formatYTick(v)}${ySuffix}`}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              width={36}
              domain={[0, (max: number) => Math.ceil(max * 1.1)]}
              allowDecimals={false}
              tickCount={4}
            />
          )}
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ strokeDasharray: "3 3", stroke: "#cbd5e1" }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.08}
            dot={false}
            activeDot={{ r: 3, fill: color, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
