import type { Metadata } from "next";

export const metadata: Metadata = { title: "We'll be right back" };

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand mark */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand-500 flex items-center justify-center shadow-soft">
          <svg
            className="h-7 w-7 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <span className="text-xl font-bold text-slate-900 tracking-tight">LocalSeat</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-card border border-slate-100 px-8 py-10 text-center">
        {/* Wrench icon */}
        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-amber-50 flex items-center justify-center">
          <svg
            className="h-7 w-7 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.653-4.654m5.96-2.183l.497.199a4.5 4.5 0 01-3.328 8.334l-1.364-.455a3 3 0 00-2.4.234l-.547.328a3 3 0 01-3.29-.441l-.526-.527a3 3 0 01-.441-3.29l.328-.547a3 3 0 00.234-2.4l-.455-1.364a4.5 4.5 0 018.334-3.328l.199.497z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-3">We&rsquo;ll be right back</h1>

        <p className="text-slate-500 text-sm leading-relaxed">
          LocalSeat is undergoing a brief update. This usually takes just a few minutes.
          Your campaign data is safe — nothing is lost during maintenance.
        </p>

        <div className="mt-8">
          <a
            href="/maintenance"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try again
          </a>
        </div>
      </div>

      <p className="mt-10 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} LocalSeat Technologies Inc.
      </p>
    </div>
  );
}
