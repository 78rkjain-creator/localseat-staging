"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";

const DISMISSED_KEY = "localseat-pwa-dismissed";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type PromptMode = "native" | "ios" | null;

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    return Date.now() - parseInt(raw, 10) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function recordDismissal() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function PwaInstallPrompt() {
  const [mode, setMode] = useState<PromptMode>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void } | null>(null);

  useEffect(() => {
    // Never show when already installed or on desktop
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (!window.matchMedia("(max-width: 768px)").matches) return;
    if (isDismissedRecently()) return;

    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isIos) {
      setMode("ios");
      return;
    }

    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt: () => void });
      setMode("native");
    }

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    setMode(null);
  }

  function handleDismiss() {
    recordDismissal();
    setMode(null);
  }

  if (!mode) return null;

  return (
    <div className="fixed bottom-20 inset-x-0 z-50 px-4 md:hidden">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl px-4 py-3.5 flex items-center gap-3">
        <Logo size={24} tone="ink" />

        <div className="flex-1 min-w-0">
          {mode === "ios" ? (
            <p className="text-sm text-slate-700 leading-snug">
              Tap{" "}
              <svg className="inline h-4 w-4 text-slate-500 align-middle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>{" "}
              then <strong className="font-semibold">Add to Home Screen</strong>
            </p>
          ) : (
            <p className="text-sm text-slate-700 leading-snug">
              Install LocalSeat for faster access
            </p>
          )}
        </div>

        {mode === "native" && (
          <button
            onClick={handleInstall}
            className="flex-none h-8 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors"
          >
            Install
          </button>
        )}

        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex-none h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
