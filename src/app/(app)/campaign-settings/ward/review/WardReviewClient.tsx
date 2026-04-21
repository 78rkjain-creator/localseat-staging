"use client";

import { useState, useTransition } from "react";
import {
  acceptOutsidePerson,
  discardOutsidePerson,
  acceptAllOutsidePersons,
  discardAllOutsidePersons,
} from "./actions";
import type { FlaggedPerson } from "./page";

interface Props {
  people: FlaggedPerson[];
}

export function WardReviewClient({ people: initialPeople }: Props) {
  const [people, setPeople] = useState<FlaggedPerson[]>(initialPeople);
  const [error, setError]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove(id: string) {
    setPeople((prev) => prev.filter((p) => p.id !== id));
  }

  function removeAll() {
    setPeople([]);
  }

  function handleAccept(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await acceptOutsidePerson(id);
      if (res.error) { setError(res.error); return; }
      remove(id);
    });
  }

  function handleDiscard(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await discardOutsidePerson(id);
      if (res.error) { setError(res.error); return; }
      remove(id);
    });
  }

  function handleAcceptAll() {
    setError(null);
    const ids = people.map((p) => p.id);
    startTransition(async () => {
      const res = await acceptAllOutsidePersons(ids);
      if (res.error) { setError(res.error); return; }
      removeAll();
    });
  }

  function handleDiscardAll() {
    setError(null);
    const ids = people.map((p) => p.id);
    startTransition(async () => {
      const res = await discardAllOutsidePersons(ids);
      if (res.error) { setError(res.error); return; }
      removeAll();
    });
  }

  if (people.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-slate-900">No voters are waiting for review.</p>
        <p className="text-xs text-slate-400 mt-1">All flagged records have been resolved.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bulk actions */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500 mr-1">
          {people.length} record{people.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={handleAcceptAll}
          disabled={isPending}
          className="inline-flex items-center h-8 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Save all
        </button>
        <button
          onClick={handleDiscardAll}
          disabled={isPending}
          className="inline-flex items-center h-8 px-3 rounded-xl border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Discard all
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Name
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Address
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {people.map((person) => (
              <tr key={person.id} className={isPending ? "opacity-60" : ""}>
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-900">
                    {person.firstName} {person.lastName}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {person.address ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <WardStatusBadge status={person.wardStatus} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => handleAccept(person.id)}
                      disabled={isPending}
                      className="text-xs px-3 py-1.5 rounded-xl font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Save anyway
                    </button>
                    <button
                      onClick={() => handleDiscard(person.id)}
                      disabled={isPending}
                      className="text-xs px-3 py-1.5 rounded-xl font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Discard
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WardStatusBadge({ status }: { status: "outside" | "pending_review" }) {
  if (status === "outside") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700">
        Outside ward
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
      Pending review
    </span>
  );
}
