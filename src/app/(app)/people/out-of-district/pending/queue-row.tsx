"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { approveOutOfDistrict, rejectOutOfDistrict } from "../../[personId]/out-of-district-actions";

export interface QueueRowPerson {
  id: string;
  firstName: string;
  lastName: string;
  outOfDistrictRequestedAt: Date | null;
  outOfDistrictRequester: { firstName: string; lastName: string } | null;
  household: {
    address: {
      streetNumber: string;
      streetName: string;
      unitNumber: string | null;
      city: string;
    };
  } | null;
}

interface Props {
  person: QueueRowPerson;
}

export function QueueRow({ person }: Props) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (done) return null;

  const address = person.household?.address;
  const addressLine = address
    ? `${address.streetNumber} ${address.streetName}${address.unitNumber ? ` #${address.unitNumber}` : ""}, ${address.city}`
    : null;

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveOutOfDistrict(person.id);
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
      }
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectOutOfDistrict(person.id, rejectReason || undefined);
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
      }
    });
  }

  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-sm font-semibold text-slate-500">
            {person.firstName[0]}{person.lastName[0]}
          </span>
        </div>

        {/* Name + address + requested by */}
        <div className="min-w-0 flex-1">
          <Link
            href={`/people/${person.id}`}
            className="font-semibold text-slate-900 hover:text-brand-600 transition-colors"
          >
            {person.firstName} {person.lastName}
          </Link>
          {addressLine && (
            <p className="text-sm text-slate-500 mt-0.5">{addressLine}</p>
          )}
          {person.outOfDistrictRequester && (
            <p className="text-xs text-slate-400 mt-1">
              Requested by {person.outOfDistrictRequester.firstName} {person.outOfDistrictRequester.lastName}
              {person.outOfDistrictRequestedAt
                ? ` · ${formatDate(new Date(person.outOfDistrictRequestedAt))}`
                : ""}
            </p>
          )}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

          {/* Reject form */}
          {showRejectForm && (
            <div className="mt-2.5 flex flex-col gap-2 max-w-sm">
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (optional)"
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isPending}
                  className="h-7 px-3 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isPending ? "Rejecting…" : "Confirm rejection"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowRejectForm(false); setRejectReason(""); }}
                  disabled={isPending}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {!showRejectForm && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isPending}
              className="h-8 px-3 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {isPending ? "…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              disabled={isPending}
              className="h-8 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}
