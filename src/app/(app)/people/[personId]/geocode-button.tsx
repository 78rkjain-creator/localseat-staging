"use client";

import { useState, useTransition } from "react";
import { geocodePerson } from "./actions";

interface Props {
  personId: string;
  lat: number | null;
  lng: number | null;
  wardStatus: string;
  hasCompleteAddress: boolean;
}

export function GeocodeButton({ personId, lat, lng, wardStatus, hasCompleteAddress }: Props) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Show when: address is geocodeable (has required fields) AND either ungeocoded or unclassified.
  // geocodeAndClassifyAddress silently skips addresses with empty streetNumber/streetName/city,
  // so we only offer the button when it can actually do something.
  const shouldShow =
    hasCompleteAddress && (lat === null || lng === null || wardStatus === "not_checked");
  if (!shouldShow) return null;

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await geocodePerson(personId);
      if (result.error) {
        setMessage({ text: result.error, ok: false });
      } else {
        setMessage({ text: "Geocoded", ok: true });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors"
      >
        <svg
          className="h-3 w-3"
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
        {isPending ? "Geocoding…" : "Geocode now"}
      </button>
      {message && (
        <span
          className={[
            "text-xs",
            message.ok ? "text-emerald-600" : "text-red-500",
          ].join(" ")}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
