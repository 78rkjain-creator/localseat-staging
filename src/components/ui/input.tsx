"use client";

import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, suffix, id, className = "", ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-slate-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={[
              "h-12 w-full rounded-2xl border bg-white px-4 text-slate-900 placeholder:text-slate-400",
              "transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent",
              error
                ? "border-red-400 focus:ring-red-400"
                : "border-slate-200 hover:border-slate-300",
              "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
              suffix ? "pr-12" : "",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...props}
          />
          {suffix && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-1">
              {suffix}
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {hint && !error && <p className="text-sm text-slate-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
