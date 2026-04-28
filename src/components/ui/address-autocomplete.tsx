"use client";

import { useState, useEffect, useRef } from "react";

export interface ParsedAddress {
  streetNumber: string;
  streetName: string;
  unitNumber: string;
  city: string;
  province: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
}

interface MapboxContext {
  id: string;
  text: string;
  short_code?: string;
}

interface MapboxFeature {
  address?: string;
  text: string;
  center: [number, number];
  place_name: string;
  context?: MapboxContext[];
}

interface Props {
  onSelect: (address: ParsedAddress) => void;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
}

function parseFeature(feature: MapboxFeature): ParsedAddress {
  const streetNumber = feature.address ?? "";
  const streetName = feature.text;
  const [lng, lat] = feature.center;

  let postalCode = "";
  let city = "";
  let province = "";

  for (const ctx of feature.context ?? []) {
    if (ctx.id.startsWith("postcode")) {
      postalCode = ctx.text;
    } else if (ctx.id.startsWith("place")) {
      city = ctx.text;
    } else if (ctx.id.startsWith("region")) {
      // short_code is like "CA-ON" — take just the abbreviation after the dash
      if (ctx.short_code) {
        const parts = ctx.short_code.split("-");
        province = parts[parts.length - 1] ?? ctx.text;
      } else {
        province = ctx.text;
      }
    }
  }

  return { streetNumber, streetName, unitNumber: "", city, province, postalCode, lat, lng };
}

const DEFAULT_INPUT_CLS =
  "h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full";

export function AddressAutocomplete({
  onSelect,
  placeholder = "Search for an address…",
  disabled,
  inputClassName,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapboxFeature[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token) return;

        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
          `?access_token=${token}&country=ca&types=address&limit=5`;

        const res = await fetch(url);
        if (!res.ok) return;

        const data = (await res.json()) as { features?: MapboxFeature[] };
        const features = data.features ?? [];
        setResults(features);
        setOpen(features.length > 0);
      } catch {
        // silently ignore network errors in the combobox
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSelect(feature: MapboxFeature) {
    onSelect(parseFeature(feature));
    setQuery("");
    setOpen(false);
    setResults([]);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={inputClassName ?? DEFAULT_INPUT_CLS}
      />
      {open && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {results.map((feature, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(feature);
              }}
              className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
            >
              {feature.place_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
