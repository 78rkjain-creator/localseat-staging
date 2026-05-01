"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function NotFoundFallback() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push("/login"), 1500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl border-2 border-slate-100 shadow-card p-8 flex flex-col items-center text-center gap-5">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100">
          <svg
            className="h-6 w-6 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-bold text-slate-900">Page not found</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            This page doesn&apos;t exist or may have been moved.
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Redirecting you now…</p>
        </div>

        <Link
          href="/login"
          className="text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors"
        >
          Go to login →
        </Link>
      </div>
    </div>
  );
}
