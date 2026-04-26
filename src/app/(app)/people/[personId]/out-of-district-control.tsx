"use client";

import { useState, useTransition } from "react";
import {
  requestOutOfDistrictMark,
  approveOutOfDistrict,
  rejectOutOfDistrict,
  removeOutOfDistrict,
} from "./out-of-district-actions";

interface Props {
  personId: string;
  isOutOfDistrict: boolean;
  approvalStatus: string | null;
  requestedBy: { firstName: string; lastName: string } | null;
  requestedAt: Date | null;
  rejectionReason: string | null;
  canMark: boolean;
  canApprove: boolean;
}

export function OutOfDistrictControl({
  personId,
  isOutOfDistrict,
  approvalStatus,
  requestedBy,
  requestedAt,
  rejectionReason,
  canMark,
  canApprove,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  function handleMark() {
    run(() => requestOutOfDistrictMark(personId));
  }

  function handleApprove() {
    run(() => approveOutOfDistrict(personId));
  }

  function handleReject() {
    run(async () => {
      const result = await rejectOutOfDistrict(personId, rejectReason || undefined);
      if (!result.error) {
        setShowRejectForm(false);
        setRejectReason("");
      }
      return result;
    });
  }

  function handleRemove() {
    run(() => removeOutOfDistrict(personId));
  }

  const isPendingStatus = approvalStatus === "pending";
  const isApproved = isOutOfDistrict && approvalStatus === "approved";
  const isRejected = !isOutOfDistrict && approvalStatus === "rejected";

  // Pending approval state
  if (isPendingStatus) {
    return (
      <div className="pt-3 mt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Out of District — pending approval
          </span>
        </div>
        {requestedBy && (
          <p className="text-xs text-slate-400 mt-1.5">
            Requested by {requestedBy.firstName} {requestedBy.lastName}
            {requestedAt ? ` · ${formatDate(new Date(requestedAt))}` : ""}
          </p>
        )}

        {canApprove && !showRejectForm && (
          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isPending}
              className="h-7 px-3 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {isPending ? "…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              disabled={isPending}
              className="h-7 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}

        {canApprove && showRejectForm && (
          <div className="mt-2.5 flex flex-col gap-2">
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason (optional)"
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
                {isPending ? "…" : "Confirm rejection"}
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

        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // Approved state
  if (isApproved) {
    return (
      <div className="pt-3 mt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
            Out of District
            {canApprove && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isPending}
                aria-label="Remove out-of-district mark"
                className="h-3.5 w-3.5 flex items-center justify-center rounded-full text-orange-500 hover:text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        </div>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // Not marked (or rejected) — show mark button
  if (canMark) {
    return (
      <div className="pt-3 mt-3 border-t border-slate-100">
        {isRejected && (
          <div className="mb-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
              Request rejected
            </span>
            {rejectionReason && (
              <p className="text-xs text-slate-500 mt-1">{rejectionReason}</p>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={handleMark}
          disabled={isPending}
          className="h-7 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Mark out of district"}
        </button>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return null;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}
