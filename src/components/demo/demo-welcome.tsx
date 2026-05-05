"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DemoWelcomeProps {
  demoMode: boolean;
}

export function DemoWelcome({ demoMode }: DemoWelcomeProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!demoMode) return;
    const dismissed = sessionStorage.getItem("demo-welcome-dismissed");
    if (dismissed !== "true") setVisible(true);
  }, [demoMode]);

  function dismiss() {
    sessionStorage.setItem("demo-welcome-dismissed", "true");
    setVisible(false);
  }

  if (!demoMode || !visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={dismiss} />

      {/* Card */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header accent */}
        <div className="h-1.5 bg-gradient-to-r from-brand-400 via-brand-500 to-orange-400" />

        <div className="px-7 py-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="h-11 w-11 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0">
              <svg className="h-5 w-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Welcome to Localseat</h2>
              <p className="text-sm text-slate-500 mt-0.5">Owen Sound Ward 4 — Demo Campaign</p>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed mb-5">
            This is a live demo of the Localseat municipal campaign platform. All data is fictional and reflects a sample Ward 4 campaign in Owen Sound, Ontario. Explore freely — nothing you do here affects real voters or campaigns.
          </p>

          <div className="bg-slate-50 rounded-2xl px-4 py-4 mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Try these</p>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/canvassing"
                  onClick={dismiss}
                  className="flex items-center gap-3 text-sm text-slate-700 hover:text-brand-600 transition-colors"
                >
                  <span className="h-6 w-6 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <svg className="h-3.5 w-3.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </span>
                  <span>Open a walk list and canvass a door</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/reports/canvassing"
                  onClick={dismiss}
                  className="flex items-center gap-3 text-sm text-slate-700 hover:text-brand-600 transition-colors"
                >
                  <span className="h-6 w-6 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <svg className="h-3.5 w-3.5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </span>
                  <span>View the canvassing activity report</span>
                </Link>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-500">
                <span className="h-6 w-6 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <span>Use <strong className="text-slate-700">Switch role</strong> in the banner above to see the app from any perspective</span>
              </li>
            </ul>
          </div>

          <button
            onClick={dismiss}
            className="w-full h-11 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold rounded-2xl transition-colors text-sm"
          >
            Got it, let me explore
          </button>
        </div>
      </div>
    </div>
  );
}
