"use client";

import { useState, useEffect } from "react";

interface DemoHintProps {
  hint: string;
  demoMode: boolean;
  storageKey: string;
}

export function DemoHint({ hint, demoMode, storageKey }: DemoHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!demoMode) return;
    const dismissed = sessionStorage.getItem(storageKey);
    if (dismissed !== "true") setVisible(true);
  }, [demoMode, storageKey]);

  function dismiss() {
    sessionStorage.setItem(storageKey, "true");
    setVisible(false);
  }

  if (!demoMode || !visible) return null;

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-start gap-3 mb-4">
      <svg className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-blue-700 flex-1 leading-snug">{hint}</p>
      <button
        onClick={dismiss}
        className="flex-shrink-0 text-blue-300 hover:text-blue-500 transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
