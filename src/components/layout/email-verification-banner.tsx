"use client";

import { useState } from "react";
import { resendVerificationEmail } from "@/app/(auth)/resend-verification/actions";

interface Props {
  email: string;
  accountCreatedAt: string; // ISO string
}

export function EmailVerificationBanner({ email, accountCreatedAt }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(false);

  if (dismissed) return null;

  const daysSince = Math.floor(
    (Date.now() - new Date(accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const isUrgent    = daysSince >= 7;
  const daysLeft    = Math.max(14 - daysSince, 0);

  async function handleResend() {
    setSending(true);
    await resendVerificationEmail(email);
    setSending(false);
    setSent(true);
    setTimeout(() => setSent(false), 5000);
  }

  return (
    <div className={[
      "w-full px-4 py-2.5 flex items-center gap-3 text-sm",
      isUrgent
        ? "bg-red-50 border-b border-red-100 text-red-800"
        : "bg-amber-50 border-b border-amber-100 text-amber-800",
    ].join(" ")}>
      <svg
        className={["h-4 w-4 flex-shrink-0", isUrgent ? "text-red-500" : "text-amber-500"].join(" ")}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>

      <p className="flex-1 min-w-0">
        {isUrgent ? (
          <>
            <span className="font-semibold">Action required:</span>{" "}
            Your account will be deactivated in{" "}
            <span className="font-semibold">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</span>{" "}
            if your email is not verified.{" "}
          </>
        ) : (
          <>
            <span className="font-semibold">Please verify your email address.</span>{" "}
            Check your inbox for a verification link, or request a new one.{" "}
          </>
        )}
      </p>

      <div className="flex items-center gap-2 flex-shrink-0">
        {sent ? (
          <span className={["text-xs font-medium", isUrgent ? "text-red-700" : "text-amber-700"].join(" ")}>
            Email sent!
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={sending}
            className={[
              "text-xs font-semibold underline underline-offset-2 transition-opacity",
              sending ? "opacity-50" : "hover:opacity-70",
              isUrgent ? "text-red-700" : "text-amber-700",
            ].join(" ")}
          >
            {sending ? "Sending…" : "Resend verification email"}
          </button>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className={["p-1 rounded transition-colors hover:bg-black/5", isUrgent ? "text-red-500" : "text-amber-500"].join(" ")}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
