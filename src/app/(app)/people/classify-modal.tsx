"use client";

import { useState, useTransition } from "react";
import { bulkClassifyTeamMembers, type BulkClassifyItem } from "./classify-actions";
import { AddressPicker, addressValueComplete, type AddressValue } from "@/components/ui/address-picker";
import { ROLE_LABELS } from "@/types";
import type { Role } from "@/types";

export interface UnclassifiedPerson {
  id: string;
  firstName: string;
  lastName: string;
  addressLine: string | null;
  role: string | null;
}

type Decision = "inside" | "outside" | "skip";

interface Props {
  people: UnclassifiedPerson[];
  onClose: () => void;
}

export function ClassifyModal({ people: initialPeople, onClose }: Props) {
  const [remaining, setRemaining] = useState(initialPeople);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [addresses, setAddresses] = useState<Record<string, AddressValue | null>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  function setDecision(personId: string, decision: Decision) {
    setDecisions(prev => ({ ...prev, [personId]: decision }));
    if (decision !== "inside") {
      setAddresses(prev => ({ ...prev, [personId]: null }));
    }
    setRowErrors(prev => {
      const next = { ...prev };
      delete next[personId];
      return next;
    });
  }

  function setAddress(personId: string, value: AddressValue | null) {
    setAddresses(prev => ({ ...prev, [personId]: value }));
  }

  function handleSaveAll() {
    setError(null);
    const newRowErrors: Record<string, string> = {};
    const items: BulkClassifyItem[] = [];

    for (const person of remaining) {
      const d = decisions[person.id] ?? "skip";
      if (d === "skip") continue;

      if (d === "inside") {
        const addrVal = addresses[person.id] ?? null;
        if (!addressValueComplete(addrVal)) {
          newRowErrors[person.id] = "Address is required for in-district.";
          continue;
        }
        items.push({ personId: person.id, decision: "inside", ...addrVal! });
      } else {
        items.push({ personId: person.id, decision: "outside" });
      }
    }

    if (Object.keys(newRowErrors).length > 0) {
      setRowErrors(newRowErrors);
      return;
    }

    if (items.length === 0) {
      onClose();
      return;
    }

    startTransition(async () => {
      const result = await bulkClassifyTeamMembers(items);

      if (result.error) {
        setError(result.error);
        return;
      }

      const failedIds = new Set(Object.keys(result.itemErrors ?? {}));
      const classifiedIds = new Set(items.map(i => i.personId).filter(id => !failedIds.has(id)));

      if (failedIds.size > 0) {
        setRowErrors(result.itemErrors ?? {});
      }

      setRemaining(prev => prev.filter(p => !classifiedIds.has(p.id)));
      setDecisions(prev => {
        const next = { ...prev };
        for (const id of classifiedIds) delete next[id];
        return next;
      });
      setAddresses(prev => {
        const next = { ...prev };
        for (const id of classifiedIds) delete next[id];
        return next;
      });
    });
  }

  const classifiedCount = remaining.filter(p => {
    const d = decisions[p.id];
    return d === "inside" || d === "outside";
  }).length;

  const hasAnyClassified = classifiedCount > 0;

  if (remaining.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-8 text-center">
          <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-900">All classified</p>
          <p className="text-sm text-slate-500 mt-1">No more people need district classification.</p>
          <button
            onClick={onClose}
            className="mt-6 h-10 px-5 rounded-2xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Classify {remaining.length} {remaining.length === 1 ? "person" : "people"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Mark each as in-district or out-of-district. Skip defers to later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Global error */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex-shrink-0">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Row list */}
        <div className="overflow-y-auto flex-1">
          <ul className="divide-y divide-slate-100">
            {remaining.map(person => {
              const d = decisions[person.id] ?? "skip";
              const addrVal = addresses[person.id] ?? null;
              const rowErr = rowErrors[person.id];
              const roleLabel = person.role
                ? (ROLE_LABELS[person.role as Role] ?? person.role)
                : null;

              return (
                <li key={person.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-slate-500">
                        {person.firstName[0]}{person.lastName[0]}
                      </span>
                    </div>

                    {/* Name + role */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">
                          {person.firstName} {person.lastName}
                        </span>
                        {roleLabel && (
                          <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                            {roleLabel}
                          </span>
                        )}
                      </div>
                      {person.addressLine && (
                        <p className="text-xs text-slate-500 mt-0.5">{person.addressLine}</p>
                      )}
                    </div>

                    {/* Radio buttons */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {(["inside", "outside", "skip"] as const).map(opt => (
                        <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`district_${person.id}`}
                            value={opt}
                            checked={d === opt}
                            onChange={() => setDecision(person.id, opt)}
                            className="h-3.5 w-3.5 text-brand-600 border-slate-300 focus:ring-brand-500"
                          />
                          <span
                            className={[
                              "text-xs font-medium",
                              opt === "inside"
                                ? "text-emerald-700"
                                : opt === "outside"
                                ? "text-orange-700"
                                : "text-slate-400",
                            ].join(" ")}
                          >
                            {opt === "inside" ? "Inside" : opt === "outside" ? "Outside" : "Skip"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Compact address picker when Inside is selected */}
                  {d === "inside" && (
                    <div className="mt-2.5 ml-11">
                      <AddressPicker onChange={v => setAddress(person.id, v)} compact />
                      {!addressValueComplete(addrVal) && !rowErr && (
                        <p className="text-xs text-slate-400 mt-1">Address required to save.</p>
                      )}
                    </div>
                  )}

                  {/* Row error */}
                  {rowErr && (
                    <p className="ml-11 mt-1.5 text-xs text-red-600">{rowErr}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <p className="text-xs text-slate-500">
            {hasAnyClassified
              ? `${classifiedCount} ready to save`
              : "Select Inside or Outside to classify"}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-10 px-4 rounded-2xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={!hasAnyClassified || isPending}
              className="h-10 px-5 rounded-2xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : `Save (${classifiedCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
