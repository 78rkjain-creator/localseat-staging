"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { mergePersons } from "../actions";
import type { DuplicatePair } from "@/lib/people";

interface MergeUiProps {
  pairs: DuplicatePair[];
}

export function MergeUi({ pairs: initialPairs }: MergeUiProps) {
  const [pairs, setPairs] = useState(initialPairs);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [mergeError, setMergeError] = useState<string | null>(null);

  const visiblePairs = pairs.filter((_, i) => !dismissed.has(i));

  if (visiblePairs.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-base font-semibold text-slate-900 mb-1">No duplicates found</p>
        <p className="text-sm text-slate-500">All records have unique name + address combinations.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {mergeError && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-600">{mergeError}</p>
        </div>
      )}
      {pairs.map((pair, idx) => {
        if (dismissed.has(idx)) return null;
        return (
          <DuplicatePairCard
            key={`${pair[0].id}-${pair[1].id}`}
            pair={pair}
            onMerge={async (winnerId, loserId) => {
              setMergeError(null);
              const result = await mergePersons({ winnerId, loserId });
              if (result.error) {
                setMergeError(result.error);
              } else {
                setDismissed((prev) => new Set([...prev, idx]));
              }
            }}
            onDismiss={() => setDismissed((prev) => new Set([...prev, idx]))}
          />
        );
      })}
    </div>
  );
}

type PersonRow = DuplicatePair[number];

function DuplicatePairCard({
  pair,
  onMerge,
  onDismiss,
}: {
  pair: DuplicatePair;
  onMerge: (winnerId: string, loserId: string) => Promise<void>;
  onDismiss: () => void;
}) {
  const [left, right] = [...pair].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  ) as [typeof pair[0], typeof pair[1]];
  const [isPending, startTransition] = useTransition();
  const [mergingWith, setMergingWith] = useState<string | null>(null);

  function handleMerge(winnerId: string, loserId: string) {
    setMergingWith(winnerId);
    startTransition(async () => {
      await onMerge(winnerId, loserId);
      setMergingWith(null);
    });
  }

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm font-medium text-amber-800">Potential duplicate</span>
        </div>
        <button
          onClick={onDismiss}
          disabled={isPending}
          className="text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors disabled:opacity-50"
        >
          Not a duplicate
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <PersonCard person={left} label="Original record" />
        <PersonCard person={right} label="New record" />
      </div>

      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
        <p className="text-xs text-slate-500 flex-1 self-center">
          Choose which record to keep. The other will be tagged <code className="bg-slate-200 px-1 rounded">record-outdated</code> and removed.
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => handleMerge(left.id, right.id)}
            disabled={isPending}
            className={[
              "h-10 px-4 rounded-2xl text-sm font-medium border transition-all",
              isPending && mergingWith === left.id
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700",
              isPending ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {isPending && mergingWith === left.id ? "Merging…" : "Keep original record"}
          </button>
          <button
            onClick={() => handleMerge(right.id, left.id)}
            disabled={isPending}
            className={[
              "h-10 px-4 rounded-2xl text-sm font-medium border transition-all",
              isPending && mergingWith === right.id
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700",
              isPending ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {isPending && mergingWith === right.id ? "Merging…" : "Keep new record"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonCard({ person, label }: { person: PersonRow; label: string }) {
  const addr = person.household?.address;
  const addressLine = addr
    ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
    : null;
  const cityLine = addr ? `${addr.city}` : null;

  return (
    <div className="px-5 py-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <Link
            href={`/voter-list/${person.id}`}
            className="font-semibold text-slate-900 hover:text-brand-600 transition-colors"
          >
            {person.firstName} {person.lastName}
          </Link>
          {person.birthYear && (
            <p className="text-xs text-slate-400 mt-0.5">b. {person.birthYear}</p>
          )}
        </div>
        <span className="text-xs text-slate-400 flex-shrink-0">
          #{person.id.slice(-6)}
        </span>
      </div>

      <dl className="flex flex-col gap-1.5">
        {addressLine && (
          <DataRow label="Address">
            {addressLine}
            {cityLine && <span className="text-slate-400">, {cityLine}</span>}
          </DataRow>
        )}
        {person.phoneHome && <DataRow label="Phone (home)">{person.phoneHome}</DataRow>}
        {person.phoneMobile && <DataRow label="Phone (mobile)">{person.phoneMobile}</DataRow>}
        {person.email && <DataRow label="Email">{person.email}</DataRow>}
        {person.sourceNotes && (
          <DataRow label="Source">{person.sourceNotes}</DataRow>
        )}
        <DataRow label="Added">
          {new Date(person.createdAt).toLocaleDateString("en-CA", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </DataRow>
      </dl>

      {person.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {person.tags.map(({ tag }) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
              style={
                tag.color
                  ? {
                      backgroundColor: tag.color + "18",
                      color: tag.color,
                      borderColor: tag.color + "40",
                    }
                  : undefined
              }
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs">
      <dt className="text-slate-400 flex-shrink-0 w-14">{label}</dt>
      <dd className="text-slate-700 min-w-0 break-words">{children}</dd>
    </div>
  );
}
