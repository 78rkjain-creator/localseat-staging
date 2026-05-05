interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "hero" | "inline";
  valueClassName?: string;
}

export function StatCard({
  label,
  value,
  sub,
  variant = "default",
  valueClassName,
}: StatCardProps) {
  if (variant === "hero") {
    return (
      <div className="bg-gradient-to-br from-white to-orange-50/40 rounded-2xl border border-slate-100 px-6 py-5">
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
        <p className={`text-3xl font-bold tabular-nums ${valueClassName ?? "text-slate-900"}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="bg-slate-50 rounded-xl px-4 py-3">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
        <p className={`text-xl font-bold tabular-nums ${valueClassName ?? "text-slate-900"}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valueClassName ?? "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
