"use client";

import { useState, useEffect } from "react";
import type { FieldMessageItem } from "@/lib/field-messages";

interface Props {
  messages: FieldMessageItem[];
}

const STORAGE_KEY = "dismissed_field_messages";

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function addDismissed(id: string) {
  const dismissed = getDismissed();
  if (!dismissed.includes(id)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed, id]));
  }
}

export function FieldMessagesBanner({ messages }: Props) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDismissed(getDismissed());
    setMounted(true);
  }, []);

  const visible = messages.filter((m) => !dismissed.includes(m.id));

  if (!mounted || visible.length === 0) return null;

  function dismiss(id: string) {
    addDismissed(id);
    setDismissed((prev) => [...prev, id]);
  }

  return (
    <div className="flex flex-col gap-2 mb-6">
      {visible.map((msg) => {
        const isUrgent = msg.priority === "urgent";
        return (
          <div
            key={msg.id}
            className={[
              "rounded-2xl border px-4 py-3 flex items-start gap-3",
              isUrgent
                ? "bg-amber-50 border-amber-300"
                : "bg-slate-50 border-slate-200",
            ].join(" ")}
          >
            <div className="flex-shrink-0 mt-0.5">
              {isUrgent ? (
                <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={[
                "text-sm font-semibold leading-snug",
                isUrgent ? "text-amber-900" : "text-slate-800",
              ].join(" ")}>
                {msg.title}
              </p>
              <p className={[
                "text-sm mt-0.5 leading-snug",
                isUrgent ? "text-amber-800" : "text-slate-600",
              ].join(" ")}>
                {msg.content}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(msg.id)}
              aria-label="Dismiss"
              className={[
                "flex-shrink-0 transition-colors",
                isUrgent ? "text-amber-500 hover:text-amber-700" : "text-slate-400 hover:text-slate-600",
              ].join(" ")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
