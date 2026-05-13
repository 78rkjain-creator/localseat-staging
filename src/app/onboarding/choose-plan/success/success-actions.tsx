"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * After payment, the Stripe webhook creates the campaign and membership.
 * This component refreshes the NextAuth JWT so the new membership is in
 * the session, then navigates to the dashboard.
 *
 * It retries a few times because the webhook may not have fired yet when
 * the user lands on this page.
 */
export function SuccessActions() {
  const { update } = useSession();
  const [status, setStatus] = useState<"refreshing" | "ready" | "error">("refreshing");

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 6; // ~6 seconds total
    const interval = 1000;

    async function tryRefresh() {
      attempts += 1;
      try {
        const result = await update({ refreshMemberships: true });
        // Check if memberships were populated
        const memberships = result?.user?.memberships ?? [];
        if (memberships.length > 0) {
          setStatus("ready");
          // Small delay so the user sees the success state
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 500);
          return;
        }
      } catch {
        // Session update failed, will retry
      }

      if (attempts < maxAttempts) {
        setTimeout(tryRefresh, interval);
      } else {
        // Webhook might be slow — let the user proceed manually
        setStatus("ready");
      }
    }

    tryRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "refreshing") {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 flex items-center justify-center">
          <svg className="h-5 w-5 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-sm text-slate-400">Setting up your campaign…</p>
      </div>
    );
  }

  return (
    <a
      href="/dashboard"
      className="inline-flex w-full items-center justify-center h-12 rounded-2xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition-colors"
    >
      Go to dashboard
    </a>
  );
}
