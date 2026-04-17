"use client";

import { useState, useTransition } from "react";
import { sendPasswordResetLink } from "./actions";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await sendPasswordResetLink(userId);
      if (result.error) {
        setError(result.error);
      } else {
        setSent(true);
      }
      setConfirmed(false);
    });
  }

  if (sent) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
        <p className="text-sm font-semibold text-green-800 mb-0.5">Reset link sent</p>
        <p className="text-xs text-green-700">
          An email with a password reset link has been sent to the user. The link expires in 1 hour.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-2 text-xs text-green-600 hover:underline"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {confirmed && (
        <p className="text-xs text-amber-700">
          This will send a password reset email to the user. Click again to confirm.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleClick}
        disabled={isPending}
        className={[
          "inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50",
          confirmed
            ? "bg-amber-500 text-white hover:bg-amber-600"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200",
        ].join(" ")}
      >
        {isPending ? "Sending…" : confirmed ? "Confirm — send email" : "Send reset link"}
      </button>
    </div>
  );
}
