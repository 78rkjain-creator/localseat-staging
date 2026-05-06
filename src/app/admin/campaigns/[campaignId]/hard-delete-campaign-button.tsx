"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { hardDeleteCampaign } from "./actions";

export function HardDeleteCampaignButton({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const isConfirmed = confirmText === campaignName;

  function open() {
    setConfirmText("");
    setError(null);
    setIsOpen(true);
  }

  function close() {
    if (isPending) return;
    setIsOpen(false);
    setConfirmText("");
    setError(null);
  }

  // Focus input after modal opens
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isPending]);

  function handleDelete() {
    if (!isConfirmed || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await hardDeleteCampaign(campaignId);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/admin/campaigns");
      }
    });
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={open}
        className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 transition-colors text-left"
      >
        Delete campaign permanently
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hard-delete-campaign-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl px-6 py-6 sm:px-8 sm:py-7 max-h-[90dvh] overflow-y-auto sm:mx-4">

            {/* Header */}
            <div className="flex items-start gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2
                id="hard-delete-campaign-title"
                className="text-lg font-bold text-red-700 flex-1 pt-1.5"
              >
                Permanently delete campaign
              </h2>
              <button
                onClick={close}
                disabled={isPending}
                className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0 disabled:opacity-50"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              This will permanently delete{" "}
              <strong className="text-slate-900">{campaignName}</strong> and all
              associated data including people, canvass responses, walk lists,
              donor records, tasks, outreach logs, events, survey responses, audit
              logs, and memberships. This action cannot be undone.
            </p>

            {/* Name confirmation */}
            <div className="mb-5">
              <label
                htmlFor="confirm-campaign-name"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Type{" "}
                <span className="font-semibold text-slate-900">{campaignName}</span>{" "}
                to confirm
              </label>
              <input
                ref={inputRef}
                id="confirm-campaign-name"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={isPending}
                autoComplete="off"
                spellCheck={false}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50"
                placeholder={campaignName}
              />
              <p className="text-xs text-slate-500 mt-1">Type the campaign name to confirm</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4">
                {error}
              </p>
            )}

            {/* Delete button */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={!isConfirmed || isPending}
              className="w-full h-11 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-3"
            >
              {isPending ? "Deleting…" : "Delete permanently"}
            </button>

            {/* Cancel */}
            <div className="text-center">
              <button
                type="button"
                onClick={close}
                disabled={isPending}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
