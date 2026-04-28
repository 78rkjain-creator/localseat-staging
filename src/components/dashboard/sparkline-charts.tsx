"use client";

import { BarChart, Bar, Cell, AreaChart, Area, ResponsiveContainer } from "recharts";

export type SeriesPoint = { date: string; count: number };

function dayLabel(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en", { weekday: "short" }).slice(0, 3);
}

interface BarSparklineProps {
  data: SeriesPoint[];
  height?: number;
  showLabels?: boolean;
}

export function BarSparkline({ data, height = 48, showLabels = true }: BarSparklineProps) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap="25%">
          <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === data.length - 1 ? "#f97316" : "rgba(148,163,184,0.4)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {showLabels && (
        <div className="flex justify-between px-0.5 mt-0.5">
          {data.map((p, i) => (
            <span
              key={i}
              className={`text-[9px] leading-none ${
                i === data.length - 1 ? "font-bold text-slate-700" : "text-slate-400"
              }`}
            >
              {dayLabel(p.date)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface LineSparklineProps {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  showLabels?: boolean;
}

export function LineSparkline({
  data,
  color = "#22c55e",
  height = 48,
  showLabels = true,
}: LineSparklineProps) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area
            type="monotone"
            dataKey="count"
            stroke={color}
            strokeWidth={1.5}
            fill={color}
            fillOpacity={0.1}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      {showLabels && (
        <div className="flex justify-between px-0.5 mt-0.5">
          {data.map((p, i) => (
            <span
              key={i}
              className={`text-[9px] leading-none ${
                i === data.length - 1 ? "font-bold text-slate-700" : "text-slate-400"
              }`}
            >
              {dayLabel(p.date)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
