import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md bg-white rounded-3xl border-2 border-slate-100 shadow-card p-8 flex flex-col items-center text-center gap-6">
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

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold text-slate-900">Page not found</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            This page doesn&apos;t exist or may have been moved.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="w-full h-12 flex items-center justify-center rounded-2xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition-colors"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
