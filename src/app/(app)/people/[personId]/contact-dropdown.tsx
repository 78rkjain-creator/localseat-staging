"use client";

import { useState, useRef, useEffect } from "react";
import { Phone, Smartphone, MessageSquare, Mail } from "lucide-react";

interface ContactMethod {
  type: "call-home" | "call-mobile" | "sms-home" | "sms-mobile" | "email";
  label: string;
  href: string;
  warning?: string;
  icon: React.ReactNode;
}

interface Props {
  phoneHome: string | null;
  phoneMobile: string | null;
  email: string | null;
}

export function ContactDropdown({ phoneHome, phoneMobile, email }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const methods: ContactMethod[] = [];

  if (phoneHome) {
    methods.push({
      type: "call-home",
      label: `Call ${phoneHome}`,
      href: `tel:${phoneHome}`,
      icon: <Phone className="h-4 w-4" />,
    });
    methods.push({
      type: "sms-home",
      label: `SMS ${phoneHome}`,
      href: `sms:${phoneHome}`,
      warning: "This is a home phone and may not receive texts.",
      icon: <MessageSquare className="h-4 w-4" />,
    });
  }

  if (phoneMobile && phoneMobile !== phoneHome) {
    methods.push({
      type: "call-mobile",
      label: `Call ${phoneMobile}`,
      href: `tel:${phoneMobile}`,
      icon: <Smartphone className="h-4 w-4" />,
    });
    methods.push({
      type: "sms-mobile",
      label: `SMS ${phoneMobile}`,
      href: `sms:${phoneMobile}`,
      icon: <MessageSquare className="h-4 w-4" />,
    });
  }

  if (email) {
    methods.push({
      type: "email",
      label: email,
      href: `mailto:${email}`,
      icon: <Mail className="h-4 w-4" />,
    });
  }

  if (methods.length === 0) return null;

  function handleMethod(method: ContactMethod, e: React.MouseEvent) {
    if (method.warning) {
      e.preventDefault();
      const ok = window.confirm(`${method.warning} Continue?`);
      if (ok) window.location.href = method.href;
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition-colors"
      >
        <Phone className="h-3.5 w-3.5" />
        Contact
        <svg
          className={["h-3 w-3 transition-transform", open ? "rotate-180" : ""].join(" ")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden min-w-[220px]">
          {methods.map((method) => (
            <a
              key={method.type}
              href={method.href}
              onClick={(e) => handleMethod(method, e)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="text-slate-400 flex-shrink-0">{method.icon}</span>
              <span className="min-w-0 truncate">{method.label}</span>
              {method.warning && (
                <span className="flex-shrink-0 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">
                  Home
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
