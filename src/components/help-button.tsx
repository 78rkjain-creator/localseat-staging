"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getHelpForRoute } from "@/lib/help-content";
import type { HelpEntry, HelpQuickAction } from "@/lib/help-content";

// ─── Quick-action card ──────────────────────────────────────────────────────

function ActionCard({ action, onClose }: { action: HelpQuickAction; onClose: () => void }) {
  const inner = (
    <>
      <span className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-900">{action.label}</span>
        {action.href && (
          <svg
            className="h-3.5 w-3.5 text-brand-500 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        )}
      </span>
      <span className="text-xs text-slate-500 leading-relaxed">{action.description}</span>
    </>
  );

  const className =
    "flex flex-col gap-1 px-4 py-3 rounded-xl border border-slate-100 bg-white hover:border-brand-200 hover:bg-brand-50/40 transition-colors text-left w-full";

  if (action.href) {
    return (
      <Link href={action.href} onClick={onClose} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

// ─── Main component ─────────────────────────────────────────────────────────

interface HelpButtonProps {
  /** "floating" renders the fixed FAB; "sidebar" renders a compact sidebar row */
  variant?: "floating" | "sidebar";
}

export function HelpButton({ variant = "floating" }: HelpButtonProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const help: HelpEntry | null = getHelpForRoute(pathname);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!help) return null;

  const isSidebar = variant === "sidebar";

  const triggerButton = isSidebar ? (
    <button
      ref={buttonRef}
      onClick={() => setOpen((v) => !v)}
      className={[
        "flex items-center gap-2 flex-1 px-3 py-2 text-sm rounded-xl transition-colors",
        open
          ? "bg-slate-100 text-slate-900 font-medium"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
      ].join(" ")}
      aria-label={open ? "Close help" : "Help"}
      aria-expanded={open}
    >
      <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Help
    </button>
  ) : (
    <button
      ref={buttonRef}
      onClick={() => setOpen((v) => !v)}
      className={[
        "fixed bottom-20 md:bottom-6 right-[4.5rem] z-40",
        "flex items-center justify-center",
        "h-11 w-11 rounded-full shadow-lg transition-all duration-200",
        open
          ? "bg-slate-800 text-white scale-95"
          : "bg-white text-slate-600 border border-slate-200 hover:border-brand-300 hover:text-brand-600 hover:shadow-xl",
      ].join(" ")}
      aria-label={open ? "Close help" : "Help"}
      aria-expanded={open}
    >
      {open ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
    </button>
  );

  const popup = open ? (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Help: ${help.title}`}
        className={[
          "fixed z-50",
          isSidebar
            ? "left-[15.5rem] bottom-16 w-[360px]"
            : "inset-x-0 bottom-0 sm:inset-auto sm:right-4 sm:bottom-20 md:sm:bottom-[4.5rem] w-full sm:w-[360px]",
          "bg-white",
          isSidebar ? "rounded-2xl" : "rounded-t-3xl sm:rounded-2xl",
          "shadow-2xl max-h-[80dvh] overflow-y-auto",
          "animate-help-in",
        ].join(" ")}
      >
        <div className={[
          "sticky top-0 bg-white border-b border-slate-100 px-5 pt-5 pb-4 z-10",
          isSidebar ? "rounded-t-2xl" : "rounded-t-3xl sm:rounded-t-2xl",
        ].join(" ")}>
          {!isSidebar && <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4 sm:hidden" />}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-7 w-7 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-slate-900 truncate">{help.title}</h3>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{help.summary}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0 -mt-0.5"
              aria-label="Close help"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {help.actions.length > 0 && (
          <div className="px-5 py-4 flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">How to</span>
            {help.actions.map((action) => (
              <ActionCard key={action.label} action={action} onClose={() => setOpen(false)} />
            ))}
          </div>
        )}

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <p className="text-[11px] text-slate-400 text-center">
            Need more help?{" "}
            <a href="mailto:support@localseat.io" className="text-brand-500 hover:text-brand-600 font-medium">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      {triggerButton}
      {popup}
      <style jsx>{`
        @keyframes help-slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-help-in { animation: help-slide-up 0.2s ease-out; }
      `}</style>
    </>
  );
}
