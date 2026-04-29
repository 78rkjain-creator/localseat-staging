import type { SupportLevel, CanvassOutcome } from "@/types";
import { SUPPORT_LEVEL_LABELS, CANVASS_OUTCOME_LABELS } from "@/types";

const supportLevelStyles: Record<SupportLevel, string> = {
  strong_yes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  soft_yes:   "bg-teal-50 text-teal-700 border-teal-200",
  undecided:  "bg-amber-50 text-amber-700 border-amber-200",
  soft_no:    "bg-orange-50 text-orange-700 border-orange-200",
  strong_no:  "bg-red-50 text-red-700 border-red-200",
  not_home:   "bg-slate-100 text-slate-500 border-slate-200",
};

const outcomeStyles: Record<CanvassOutcome, string> = {
  contacted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  not_home: "bg-slate-100 text-slate-500 border-slate-200",
  refused: "bg-red-50 text-red-600 border-red-200",
  moved: "bg-purple-50 text-purple-600 border-purple-200",
  unavailable: "bg-amber-50 text-amber-700 border-amber-200",
  deceased: "bg-slate-100 text-slate-500 border-slate-200",
  other_candidate: "bg-slate-100 text-slate-700 border-slate-200",
};

export function SupportLevelBadge({
  level,
  source,
}: {
  level: SupportLevel;
  source?: "canvass" | "imported";
}) {
  const isImported = source === "imported";
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        isImported ? "border-dashed" : "",
        supportLevelStyles[level],
      ].join(" ")}
      title={isImported ? "Support level imported from list" : undefined}
    >
      {SUPPORT_LEVEL_LABELS[level]}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: CanvassOutcome }) {
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        outcomeStyles[outcome],
      ].join(" ")}
    >
      {CANVASS_OUTCOME_LABELS[outcome]}
    </span>
  );
}
