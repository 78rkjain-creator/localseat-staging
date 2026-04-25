"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSignStatus } from "./actions";

export function SignStatusToggle({
  signId,
  currentStatus,
}: {
  signId: string;
  currentStatus: "to_be_installed" | "installed";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = currentStatus === "to_be_installed" ? "installed" : "to_be_installed";
    setPending(true);
    await updateSignStatus(signId, next);
    setPending(false);
    router.refresh();
  }

  if (currentStatus === "installed") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
        Installed
      </span>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-60"
    >
      {pending ? "Saving…" : "To be installed"}
    </button>
  );
}
