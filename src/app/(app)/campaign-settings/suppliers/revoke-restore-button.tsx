"use client";

import { useTransition } from "react";
import { revokeSupplierAccess, restoreSupplierAccess } from "./actions";

export function RevokeRestoreButton({
  membershipId,
  isActive,
}: {
  membershipId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      if (isActive) {
        await revokeSupplierAccess(membershipId);
      } else {
        await restoreSupplierAccess(membershipId);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={[
        "text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0",
        isActive
          ? "text-red-600 hover:bg-red-50 border border-red-200"
          : "text-emerald-700 hover:bg-emerald-50 border border-emerald-200",
      ].join(" ")}
    >
      {isPending ? "…" : isActive ? "Revoke access" : "Restore access"}
    </button>
  );
}
