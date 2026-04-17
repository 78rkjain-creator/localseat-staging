"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hardDeleteUser } from "./actions";

export function HardDeleteButton({ userId, userName }: { userId: string; userName: string }) {
  const [step, setStep] = useState<"idle" | "confirm1" | "confirm2">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (step === "idle") { setStep("confirm1"); return; }
    if (step === "confirm1") { setStep("confirm2"); return; }
    // step === "confirm2" — execute
    setError(null);
    startTransition(async () => {
      const result = await hardDeleteUser(userId);
      if (result.error) {
        setError(result.error);
        setStep("idle");
      } else {
        router.push("/admin/users");
      }
    });
  }

  const label =
    step === "idle"
      ? "Permanently delete user"
      : step === "confirm1"
      ? "Are you sure? Click again to confirm"
      : "Click once more — this cannot be undone";

  return (
    <div className="flex flex-col gap-2">
      {step === "confirm1" && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 leading-relaxed">
          This will permanently delete <strong>{userName}</strong> and all their campaign memberships, canvass assignments, and notes. Audit logs are retained. This cannot be undone.
        </p>
      )}
      {step === "confirm2" && (
        <p className="text-xs font-semibold text-red-700">
          Final confirmation: deleting {userName}…
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleClick}
          disabled={isPending}
          className={[
            "flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 text-left",
            step === "idle"
              ? "bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-700"
              : "bg-red-600 text-white hover:bg-red-700",
          ].join(" ")}
        >
          {isPending ? "Deleting…" : label}
        </button>
        {step !== "idle" && (
          <button
            onClick={() => setStep("idle")}
            disabled={isPending}
            className="px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
