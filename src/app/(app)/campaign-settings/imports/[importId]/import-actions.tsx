"use client";

import { useState, useTransition } from "react";
import { approveAndMergeImport, rejectImport } from "../actions";

export function ImportActions({
  importId,
  validCount,
}: {
  importId: string;
  validCount: number;
}) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveAndMergeImport(importId);
      if (result?.error) setError(result.error);
    });
  }

  function handleReject() {
    if (rejectNote.trim().length < 10) {
      setError("Rejection reason must be at least 10 characters.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await rejectImport(importId, rejectNote);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4">
          {error}
        </p>
      )}

      {showApproveConfirm ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-4">
          <p className="text-sm font-semibold text-slate-900 mb-1">Confirm merge</p>
          <p className="text-sm text-slate-600 mb-4">
            This will merge {validCount.toLocaleString()} records into your campaign. Continue?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowApproveConfirm(false)}
              disabled={isPending}
              className="flex-1 h-11 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isPending}
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {isPending ? "Merging…" : "Yes, merge"}
            </button>
          </div>
        </div>
      ) : null}

      {showRejectModal ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold text-slate-900 mb-3">Reason for rejection</p>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            placeholder="Explain why this upload is being rejected (min 10 characters)…"
          />
          <div className="flex gap-3 mt-3">
            <button
              type="button"
              onClick={() => { setShowRejectModal(false); setRejectNote(""); setError(null); }}
              disabled={isPending}
              className="flex-1 h-11 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending || rejectNote.trim().length < 10}
              className="flex-1 h-11 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? "Rejecting…" : "Confirm rejection"}
            </button>
          </div>
        </div>
      ) : null}

      {!showApproveConfirm && !showRejectModal && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowApproveConfirm(true)}
            disabled={isPending}
            className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 px-6"
          >
            Approve and merge
          </button>
          <button
            type="button"
            onClick={() => setShowRejectModal(true)}
            disabled={isPending}
            className="h-11 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 px-6"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
