"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CanvassActivityEntry } from "@/lib/dashboard";

interface Props {
  initialEntries: CanvassActivityEntry[];
}

const SUPPORT_LABELS: Record<string, string> = {
  strong_yes: "Strong Support",
  soft_yes: "Soft Support",
  undecided: "Undecided",
  soft_no: "Soft No",
  strong_no: "Strong No",
};

const SUPPORT_COLORS: Record<string, string> = {
  strong_yes: "text-emerald-600 font-medium",
  soft_yes: "text-emerald-500 font-medium",
  undecided: "text-amber-600 font-medium",
  soft_no: "text-red-400 font-medium",
  strong_no: "text-red-600 font-medium",
};

const OUTCOME_LABELS: Record<string, string> = {
  not_home: "not home",
  refused: "refused",
  moved: "moved",
  unavailable: "unavailable",
  deceased: "deceased",
  other_candidate: "supporting another candidate",
  contacted: "contacted",
};

function buildDescription(entry: CanvassActivityEntry): React.ReactNode {
  const person = (
    <Link
      href={`/people/${entry.personId}`}
      className="font-medium text-slate-800 hover:text-brand-600 transition-colors"
    >
      {entry.personName}
    </Link>
  );

  const at = entry.address ? (
    <span className="text-slate-500"> at {entry.address}</span>
  ) : null;

  if (entry.supportLevel && SUPPORT_LABELS[entry.supportLevel]) {
    return (
      <>
        recorded{" "}
        <span className={SUPPORT_COLORS[entry.supportLevel]}>
          {SUPPORT_LABELS[entry.supportLevel]}
        </span>{" "}
        for {person}
        {at}
      </>
    );
  }

  const outcomeLabel = OUTCOME_LABELS[entry.outcome] ?? entry.outcome.replace(/_/g, " ");
  const isNeutral = ["not_home", "refused", "moved", "unavailable", "deceased"].includes(entry.outcome);

  return (
    <>
      marked {person} as{" "}
      <span className={isNeutral ? "text-slate-400" : "text-slate-600"}>{outcomeLabel}</span>
      {at}
    </>
  );
}

function Flags({ entry }: { entry: CanvassActivityEntry }) {
  const flags = [];
  if (entry.signRequest) flags.push({ label: "Sign", color: "bg-blue-50 text-blue-600 border-blue-200" });
  if (entry.volunteerInterest) flags.push({ label: "Volunteer", color: "bg-emerald-50 text-emerald-600 border-emerald-200" });
  if (entry.donorInterest) flags.push({ label: "Donor", color: "bg-orange-50 text-orange-600 border-orange-200" });
  if (flags.length === 0) return null;
  return (
    <span className="flex gap-1 ml-1">
      {flags.map((f) => (
        <span key={f.label} className={`inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium border ${f.color}`}>
          {f.label}
        </span>
      ))}
    </span>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatUpdatedText(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 15) return "Updated just now";
  if (secs < 60) return `Updated ${secs}s ago`;
  return `Updated ${Math.floor(secs / 60)}m ago`;
}

export function CanvassActivityFeed({ initialEntries }: Props) {
  const [entries, setEntries] = useState<CanvassActivityEntry[]>(initialEntries);
  const [updatedText, setUpdatedText] = useState<string>("");
  const lastUpdatedRef = useRef<Date | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/dashboard/canvass-activity");
        if (res.ok) {
          const data: CanvassActivityEntry[] = await res.json();
          setEntries(data);
          lastUpdatedRef.current = new Date();
          setUpdatedText("Updated just now");
        }
      } catch {
        // silently ignore — stale data is fine
      }
    };

    const fetchInterval = setInterval(fetchData, 30_000);

    // Tick the "updated X ago" display every 10 seconds
    const tickInterval = setInterval(() => {
      if (lastUpdatedRef.current) {
        setUpdatedText(formatUpdatedText(lastUpdatedRef.current));
      }
    }, 10_000);

    return () => {
      clearInterval(fetchInterval);
      clearInterval(tickInterval);
    };
  }, []);

  return (
    <div>
      {/* Updated indicator */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Live canvass activity
        </h2>
        {updatedText && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {updatedText}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">No canvass activity yet.</p>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry, i) => (
            <li
              key={entry.id}
              className={["flex items-start gap-3 py-3", i > 0 ? "border-t border-slate-50" : ""].join(" ")}
            >
              {/* Avatar */}
              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-slate-500 leading-none">
                  {entry.canvasserInitials}
                </span>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-1 text-sm text-slate-600 leading-snug">
                  <span className="font-medium text-slate-800">{entry.canvasserName}</span>
                  <span>{buildDescription(entry)}</span>
                  <Flags entry={entry} />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{relativeTime(entry.respondedAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
