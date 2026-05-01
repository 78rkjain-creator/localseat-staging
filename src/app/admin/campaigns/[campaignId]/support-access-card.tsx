"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { SupportAccessStatusResult } from "@/lib/support-access";
import {
  requestSupportAccessAction,
  cancelSupportAccessRequestAction,
  revokeSupportAccessAdminAction,
  validateSupportEntry,
} from "./actions";

interface Props {
  campaignId: string;
  campaignName: string;
  initialStatus: SupportAccessStatusResult;
}

function formatDatetime(d: Date): string {
  return new Date(d).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SupportAccessCard({ campaignId, campaignName, initialStatus }: Props) {
  const [status, setStatus]     = useState(initialStatus);
  const [note, setNote]         = useState("");
  const [loading, setLoading]   = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const { update }              = useSession();
  const router                  = useRouter();

  async function handleRequest() {
    setLoading("request");
    setError(null);
    const result = await requestSupportAccessAction(campaignId, note);
    if (result.error) { setError(result.error); setLoading(null); return; }
    setNote("");
    router.refresh();
    setLoading(null);
  }

  async function handleCancel() {
    setLoading("cancel");
    setError(null);
    const result = await cancelSupportAccessRequestAction(campaignId);
    if (result.error) { setError(result.error); setLoading(null); return; }
    router.refresh();
    setLoading(null);
  }

  async function handleRevoke() {
    setLoading("revoke");
    setError(null);
    const result = await revokeSupportAccessAdminAction(campaignId);
    if (result.error) { setError(result.error); setLoading(null); return; }
    router.refresh();
    setLoading(null);
  }

  async function handleEnter(mode: "readonly" | "full") {
    setLoading(`enter-${mode}`);
    setError(null);
    const result = await validateSupportEntry(campaignId, mode);
    if (result.error) { setError(result.error); setLoading(null); return; }
    await update({ enterSupportMode: { campaignId, mode, campaignName } });
    router.push("/dashboard");
    router.refresh();
  }

  const isBusy = loading !== null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Support Access</h2>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Status: none / expired / denied / revoked — show request UI */}
      {(status.status === "none" || status.status === "expired" || status.status === "denied" || status.status === "revoked") && (
        <div className="flex flex-col gap-3">
          {status.status === "expired" && (
            <p className="text-xs text-slate-500">
              Previous access expired {status.expiresAt ? formatDatetime(status.expiresAt) : "—"}.
            </p>
          )}
          {status.status === "denied" && (
            <p className="text-xs text-slate-500">
              Access request was denied by {status.requestedByName ?? "campaign"}.
            </p>
          )}
          {status.status === "revoked" && (
            <p className="text-xs text-slate-500">Access was revoked by the campaign.</p>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Note <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Looking into the walk list issue you reported"
              disabled={isBusy}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
            />
          </div>

          <button
            onClick={handleRequest}
            disabled={isBusy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors text-left disabled:opacity-60"
          >
            {loading === "request" ? "Requesting…" : status.status === "none" ? "Request full access" : "Request again"}
          </button>

          <button
            onClick={() => handleEnter("readonly")}
            disabled={isBusy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors text-left disabled:opacity-60"
          >
            {loading === "enter-readonly" ? "Entering…" : "View campaign (read-only)"}
          </button>
        </div>
      )}

      {/* Status: pending — waiting for approval */}
      {status.status === "pending" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
            <p className="text-xs font-medium text-amber-700">Waiting for campaign approval</p>
            {status.requestedAt && (
              <p className="text-xs text-amber-600 mt-0.5">Requested {formatDatetime(status.requestedAt)}</p>
            )}
          </div>

          <button
            onClick={handleCancel}
            disabled={isBusy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-left disabled:opacity-60"
          >
            {loading === "cancel" ? "Cancelling…" : "Cancel request"}
          </button>

          <button
            onClick={() => handleEnter("readonly")}
            disabled={isBusy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors text-left disabled:opacity-60"
          >
            {loading === "enter-readonly" ? "Entering…" : "View campaign (read-only)"}
          </button>
        </div>
      )}

      {/* Status: active — full access granted */}
      {status.status === "active" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
            <p className="text-xs font-medium text-emerald-700">Full access granted</p>
            {status.expiresAt && (
              <p className="text-xs text-emerald-600 mt-0.5">
                Expires {formatDatetime(status.expiresAt)}
              </p>
            )}
          </div>

          <button
            onClick={() => handleEnter("full")}
            disabled={isBusy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors text-left disabled:opacity-60"
          >
            {loading === "enter-full" ? "Entering…" : "Enter campaign (full access)"}
          </button>

          <button
            onClick={() => handleEnter("readonly")}
            disabled={isBusy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors text-left disabled:opacity-60"
          >
            {loading === "enter-readonly" ? "Entering…" : "View campaign (read-only)"}
          </button>

          <button
            onClick={handleRevoke}
            disabled={isBusy}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-left disabled:opacity-60"
          >
            {loading === "revoke" ? "Revoking…" : "Revoke access"}
          </button>
        </div>
      )}
    </div>
  );
}
