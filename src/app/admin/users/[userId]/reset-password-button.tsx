"use client";

import { useState, useTransition } from "react";
import { resetUserPassword } from "./actions";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  function handleReset() {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await resetUserPassword(userId);
      if (result.error) {
        setError(result.error);
      } else if (result.tempPassword) {
        setTempPassword(result.tempPassword);
      }
      setConfirmed(false);
    });
  }

  if (tempPassword) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
        <p className="text-sm font-semibold text-amber-800 mb-1">Temporary password set</p>
        <p className="text-xs text-amber-700 mb-2">
          Share this with the user. It will not be shown again.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-white rounded-lg border border-amber-200 text-sm font-mono text-slate-900 select-all">
            {tempPassword}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(tempPassword)}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors flex-shrink-0"
          >
            Copy
          </button>
        </div>
        <button
          onClick={() => setTempPassword(null)}
          className="mt-3 text-xs text-amber-600 hover:underline"
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
          This will immediately invalidate the user&apos;s current password. Click again to confirm.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleReset}
        disabled={isPending}
        className={[
          "inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50",
          confirmed
            ? "bg-amber-500 text-white hover:bg-amber-600"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200",
        ].join(" ")}
      >
        {isPending ? "Resetting…" : confirmed ? "Confirm reset" : "Reset password"}
      </button>
    </div>
  );
}
