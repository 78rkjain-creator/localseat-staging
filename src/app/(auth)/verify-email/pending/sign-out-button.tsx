"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="block w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors py-1"
    >
      Sign out
    </button>
  );
}
