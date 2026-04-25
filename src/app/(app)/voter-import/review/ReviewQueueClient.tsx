"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { acceptListMemberships } from "./actions";

type AddressRow = {
  streetNumber: string;
  streetName: string;
  unitNumber: string | null;
  city: string;
  province: string;
  postalCode: string;
};

type MembershipRow = {
  id: string;
  reviewReason: string | null;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    household: { address: AddressRow | null } | null;
  };
};

type ImportGroup = {
  importId: string;
  importName: string;
  importedAt: Date;
  memberships: MembershipRow[];
};

export function ReviewQueueClient({ groups }: { groups: ImportGroup[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleGroups = groups.map((g) => ({
    ...g,
    memberships: g.memberships.filter((m) => !dismissed.has(m.id)),
  })).filter((g) => g.memberships.length > 0);

  const allVisibleIds = visibleGroups.flatMap((g) => g.memberships.map((m) => m.id));
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleGroup(membershipIds: string[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of membershipIds) {
        checked ? next.add(id) : next.delete(id);
      }
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(allVisibleIds) : new Set());
  }

  function handleAccept() {
    const ids = [...selected].filter((id) => allVisibleIds.includes(id));
    if (ids.length === 0) return;

    startTransition(async () => {
      await acceptListMemberships(ids);
      setDismissed((prev) => new Set([...prev, ...ids]));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    });
  }

  if (visibleGroups.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        No records pending review.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Bulk toolbar */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            checked={allSelected}
            onChange={(e) => toggleAll(e.target.checked)}
          />
          Select all ({allVisibleIds.length})
        </label>
        <button
          onClick={handleAccept}
          disabled={selected.size === 0 || isPending}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Accepting…" : `Accept selected (${selected.size})`}
        </button>
      </div>

      {visibleGroups.map((group) => {
        const groupIds = group.memberships.map((m) => m.id);
        const groupAllSelected = groupIds.every((id) => selected.has(id));

        return (
          <div key={group.importId} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Group header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={groupAllSelected}
                onChange={(e) => toggleGroup(groupIds, e.target.checked)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{group.importName}</p>
                <p className="text-xs text-slate-400">
                  {new Date(group.importedAt).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  {" · "}{group.memberships.length} pending
                </p>
              </div>
            </div>

            {/* Rows */}
            <ul className="divide-y divide-slate-100">
              {group.memberships.map((m) => {
                const addr = m.person.household?.address;
                const addrLine = addr
                  ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}, ${addr.city}`
                  : "No address on file";

                return (
                  <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 mt-0.5 flex-shrink-0"
                      checked={selected.has(m.id)}
                      onChange={() => toggleRow(m.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/voter-list/${m.person.id}`}
                          className="text-sm font-medium text-brand-600 hover:underline"
                        >
                          {m.person.firstName} {m.person.lastName}
                        </Link>
                        {m.reviewReason && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            {m.reviewReason}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{addrLine}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
