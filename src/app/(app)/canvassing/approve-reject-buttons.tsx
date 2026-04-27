"use client";

import { useState, useTransition } from "react";
import { approveList, rejectList } from "./actions";

interface Props {
  listId: string;
  listName: string;
}

export function ApproveRejectButtons({ listId, listName }: Props) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveList(listId);
      if (result.error) setError(result.error);
    });
  }

  function handleReject() {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    if (!reason.trim()) {
      setError("Enter a rejection reason.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await rejectList(listId, reason);
      if (result.error) setError(result.error);
      else setShowRejectInput(false);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {showRejectInput && (
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection…"
            className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            autoFocus
          />
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isPending || showRejectInput}
          className="h-8 px-3 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={isPending}
          className="h-8 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {showRejectInput ? (isPending ? "Rejecting…" : "Confirm reject") : "Reject"}
        </button>
        {showRejectInput && (
          <button
            type="button"
            onClick={() => { setShowRejectInput(false); setReason(""); setError(null); }}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
