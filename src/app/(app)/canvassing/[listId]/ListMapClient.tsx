"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { CanvassOutcome, SupportLevel } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface MapEntry {
  personId: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  outcome: CanvassOutcome | null;
  supportLevel: SupportLevel | null;
}

interface Props {
  entries: MapEntry[];
  listId: string;
  listName: string;
}

// ── Colour logic ───────────────────────────────────────────────────────────
// Priority: supportLevel → outcome → no response (grey)

const MARKER_COLOURS: Record<string, string> = {
  strong_yes:  "#22C55E",
  soft_yes:    "#86EFAC",
  undecided:   "#FBBF24",
  soft_no:     "#FB923C",
  strong_no:   "#EF4444",
  not_home:    "#60A5FA",
  refused:     "#EF4444",
  default:     "#94A3B8",
};

function markerColour(entry: MapEntry): string {
  if (entry.supportLevel && MARKER_COLOURS[entry.supportLevel]) {
    return MARKER_COLOURS[entry.supportLevel];
  }
  if (entry.outcome && MARKER_COLOURS[entry.outcome]) {
    return MARKER_COLOURS[entry.outcome];
  }
  return MARKER_COLOURS.default;
}

const LEGEND_ITEMS = [
  { label: "Strong yes",    colour: "#22C55E" },
  { label: "Soft yes",      colour: "#86EFAC" },
  { label: "Undecided",     colour: "#FBBF24" },
  { label: "Soft no",       colour: "#FB923C" },
  { label: "Strong no / refused", colour: "#EF4444" },
  { label: "Not home",      colour: "#60A5FA" },
  { label: "No response",   colour: "#94A3B8" },
];

function formatOutcome(outcome: string | null): string {
  if (!outcome) return "—";
  return outcome.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSupportLevel(level: string | null): string {
  if (!level) return "—";
  return level.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Summary counts ─────────────────────────────────────────────────────────

function summarise(entries: MapEntry[]) {
  let contacted = 0;
  let notHome   = 0;
  let remaining = 0;

  for (const e of entries) {
    if (!e.outcome) {
      remaining++;
    } else if (e.outcome === "not_home") {
      notHome++;
    } else {
      contacted++;
    }
  }

  return { total: entries.length, contacted, notHome, remaining };
}

// ── Component ──────────────────────────────────────────────────────────────

export function ListMapClient({ entries, listId, listName }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  const geocoded = entries.filter((e) => e.lat !== null && e.lng !== null);
  const summary  = summarise(entries);

  // Centroid
  const center: [number, number] =
    geocoded.length > 0
      ? [
          geocoded.reduce((s, e) => s + e.lng!, 0) / geocoded.length,
          geocoded.reduce((s, e) => s + e.lat!, 0) / geocoded.length,
        ]
      : [-79.3832, 43.6532];

  useEffect(() => {
    if (!mapContainer.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any;

    // CSS imported from the npm package to guarantee version alignment.
    Promise.all([
      import("mapbox-gl"),
      import("mapbox-gl/dist/mapbox-gl.css"),
    ]).then(([mapboxgl]) => {
      mapboxgl.default.accessToken = token;

      map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center,
        zoom: 14,
      });

      mapRef.current = map;

      map.on("load", () => {
        // Add source
        map.addSource("entries", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: geocoded.map((e) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [e.lng!, e.lat!] },
              properties: {
                personId:     e.personId,
                name:         e.name,
                address:      e.address ?? "Unknown address",
                outcome:      e.outcome ?? null,
                supportLevel: e.supportLevel ?? null,
                colour:       markerColour(e),
              },
            })),
          },
        });

        // Circles
        map.addLayer({
          id: "entry-circles",
          type: "circle",
          source: "entries",
          paint: {
            "circle-radius": 7,
            "circle-color": ["get", "colour"],
            "circle-opacity": 0.9,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Popup on click
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", "entry-circles", (e: any) => {
          const props = e.features[0].properties;
          const coords: [number, number] = e.features[0].geometry.coordinates.slice();

          const supportLine =
            props.supportLevel && props.supportLevel !== "null"
              ? `<p style="margin:2px 0;font-size:12px;color:#64748b;">
                   Support: <strong>${formatSupportLevel(props.supportLevel)}</strong>
                 </p>`
              : "";

          const outcomeLine =
            props.outcome && props.outcome !== "null"
              ? `<p style="margin:2px 0;font-size:12px;color:#64748b;">
                   Outcome: <strong>${formatOutcome(props.outcome)}</strong>
                 </p>`
              : "";

          new mapboxgl.default.Popup({ offset: 10, maxWidth: "240px" })
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family:system-ui,sans-serif;padding:4px 2px;">
                <p style="margin:0 0 4px;font-weight:600;font-size:13px;color:#0f172a;">
                  ${props.name}
                </p>
                <p style="margin:0 0 6px;font-size:12px;color:#64748b;">
                  ${props.address}
                </p>
                ${supportLine}
                ${outcomeLine}
                <a
                  href="/voter-list/${props.personId}"
                  style="display:inline-block;margin-top:8px;font-size:12px;color:#f97316;text-decoration:none;font-weight:500;"
                >
                  View record →
                </a>
              </div>
            `)
            .addTo(map);
        });

        map.on("mouseenter", "entry-circles", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "entry-circles", () => {
          map.getCanvas().style.cursor = "";
        });
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col" style={{ height: "100dvh", paddingTop: "64px" }}>
      {/* Summary bar */}
      <div className="flex-shrink-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-6">
        <Link
          href={`/canvassing/${listId}`}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mr-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">{listName}</span>
        </Link>

        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-slate-900">{summary.total}</span>
          <span className="text-xs text-slate-400">doors</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-emerald-600">{summary.contacted}</span>
          <span className="text-xs text-slate-400">contacted</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-blue-500">{summary.notHome}</span>
          <span className="text-xs text-slate-400">not home</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-slate-500">{summary.remaining}</span>
          <span className="text-xs text-slate-400">remaining</span>
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1 min-h-0 flex flex-col" style={{ overflow: "hidden" }}>
        <div ref={mapContainer} className="w-full h-full" style={{ zIndex: 1 }} />

        {/* Legend */}
        <div className="absolute bottom-8 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm px-3 py-2.5 flex flex-col gap-1.5">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full flex-shrink-0 border border-white shadow-sm"
                style={{ backgroundColor: item.colour }}
              />
              <span className="text-xs text-slate-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
