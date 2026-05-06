"use client";

import { signOut } from "next-auth/react";
import { Wordmark } from "@/components/brand/Wordmark";

interface Props {
  firstName: string;
  lastName: string;
  campaignName: string | null;
}

export function SupplierTopBar({ firstName, lastName, campaignName }: Props) {
  return (
    <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <Wordmark size={24} tone="ink" />
        {campaignName && (
          <span className="text-xs text-slate-400 border-l border-slate-200 pl-3">{campaignName}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">{firstName} {lastName}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
