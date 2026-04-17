"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition, useState, useEffect } from "react";

interface PeopleSearchBarProps {
  defaultValue: string;
}

export function PeopleSearchBar({ defaultValue }: PeopleSearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (value.trim()) {
        params.set("q", value.trim());
      }
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    }, 350);

    return () => clearTimeout(timeout);
  }, [value, pathname, router]);

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
        <svg
          className={[
            "h-4 w-4 transition-colors",
            isPending ? "text-brand-400" : "text-slate-400",
          ].join(" ")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by name, email, or phone…"
        className={[
          "h-12 w-full rounded-2xl border bg-white pl-11 pr-4 text-slate-900 placeholder:text-slate-400",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent",
          "border-slate-200 hover:border-slate-300",
        ].join(" ")}
      />
    </div>
  );
}
