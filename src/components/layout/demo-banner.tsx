"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";

const DEMO_ROLES = [
  { label: "Candidate",             name: "Alex Chen",     email: "alex.chen@example.com"    },
  { label: "Campaign Manager",      name: "Maria Santos",  email: "maria.santos@example.com" },
  { label: "Field Organizer",       name: "James Okafor",  email: "james.okafor@example.com" },
  { label: "Field Organizer",       name: "Sarah Kim",     email: "sarah.kim@example.com"    },
  { label: "Finance Lead",          name: "Dan Wu",        email: "dan.wu@example.com"       },
  { label: "Volunteer Coordinator", name: "Sara Bishop",   email: "sara.bishop@example.com"  },
  { label: "Canvasser",             name: "Priya Nair",    email: "priya.nair@example.com"   },
  { label: "Canvasser",             name: "Kevin Lafleur", email: "kevin.lafleur@example.com"},
];

interface DemoBannerProps {
  currentEmail: string;
}

export function DemoBanner({ currentEmail }: DemoBannerProps) {
  const [switching, setSwitching] = useState(false);
  const [open,      setOpen]      = useState(false);

  const current = DEMO_ROLES.find((r) => r.email === currentEmail)
    ?? { label: "Demo", name: "Demo Login", email: currentEmail };

  async function switchRole(email: string) {
    if (email === currentEmail || switching) return;
    setSwitching(true);
    setOpen(false);
    await signOut({ redirect: false });
    const result = await signIn("credentials", { email, password: "password", redirect: false });
    if (result?.ok) {
      window.location.href = "/dashboard";
    } else {
      setSwitching(false);
    }
  }

  return (
    <div className="relative z-50 bg-amber-500 text-white text-sm">
      <div className="flex items-center justify-between px-4 py-2 gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold tracking-wide uppercase flex-shrink-0">
            Demo mode
          </span>
          <span className="text-white/90 truncate">
            Viewing as <strong className="text-white">{current.label} — {current.name}</strong>
          </span>
        </div>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setOpen((v) => !v)}
            disabled={switching}
            className="flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 active:bg-white/40 px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
          >
            {switching ? "Switching…" : "Switch role"}
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-2xl shadow-lg border border-slate-100 py-1 overflow-hidden">
                {DEMO_ROLES.map((role) => (
                  <button
                    key={role.email}
                    onClick={() => switchRole(role.email)}
                    className={[
                      "w-full text-left px-4 py-2.5 flex flex-col gap-0.5 transition-colors",
                      role.email === currentEmail
                        ? "bg-brand-50 cursor-default"
                        : "hover:bg-slate-50 cursor-pointer",
                    ].join(" ")}
                  >
                    <span className="text-sm font-medium text-slate-900">{role.name}</span>
                    <span className="text-xs text-slate-500">{role.label}</span>
                    {role.email === currentEmail && (
                      <span className="text-xs text-brand-600 font-medium">Current</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
