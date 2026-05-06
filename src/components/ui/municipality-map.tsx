"use client";

import { useEffect, useRef } from "react";
import type { Polygon, MultiPolygon } from "geojson";

interface Props {
  boundary: Polygon | MultiPolygon | null;
  municipalityName: string | null;
  center?: [number, number]; // [lng, lat] — used for initial position when no boundary
  loading?: boolean;
}

function getBounds(geometry: Polygon | MultiPolygon) {
  const coords: number[][] = [];
  if (geometry.type === "Polygon") {
    coords.push(...(geometry.coordinates[0] ?? []));
  } else {
    for (const poly of geometry.coordinates) {
      coords.push(...(poly[0] ?? []));
    }
  }
  const lngs = coords.map((c) => c[0]).filter((v): v is number => v !== undefined);
  const lats = coords.map((c) => c[1]).filter((v): v is number => v !== undefined);
  if (!lngs.length || !lats.length) return null;
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

export function MunicipalityMap({ boundary, municipalityName, center, loading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!boundary) return;

    let cancelled = false;

    import("mapbox-gl").then((mod) => {
      if (cancelled || !containerRef.current) return;
      const mapboxgl = mod.default;
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token) return;
      mapboxgl.accessToken = token;

      const initialCenter = center ?? [-79.3832, 43.6532];

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        zoom: 10,
        center: initialCenter,
      });
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;
        map.addSource("municipality-boundary", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: boundary },
        });
        map.addLayer({
          id: "municipality-fill",
          type: "fill",
          source: "municipality-boundary",
          paint: {
            "fill-color": "#f97316",
            "fill-opacity": 0.15,
          },
        });
        map.addLayer({
          id: "municipality-outline",
          type: "line",
          source: "municipality-boundary",
          paint: {
            "line-color": "#ea580c",
            "line-width": 2,
          },
        });

        const bounds = getBounds(boundary);
        if (bounds) {
          map.fitBounds(
            [
              [bounds.minLng, bounds.minLat],
              [bounds.maxLng, bounds.maxLat],
            ],
            { padding: 40, duration: 800 }
          );
        }
      });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // Re-render the map when boundary changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-2xl overflow-hidden border border-slate-200 h-48 bg-slate-100 animate-pulse flex items-center justify-center">
        <p className="text-xs text-slate-400">Loading boundary…</p>
      </div>
    );
  }

  // Placeholder when no boundary
  if (!boundary) {
    return (
      <div className="flex items-center justify-center h-48 rounded-2xl bg-slate-50 border border-slate-200 border-dashed">
        <div className="text-center px-4">
          <div className="h-8 w-8 mx-auto mb-2 text-slate-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497z"
              />
            </svg>
          </div>
          <p className="text-xs text-slate-400">
            {municipalityName
              ? `No boundary data for ${municipalityName}.`
              : "Select a municipality to see its boundary on the map."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 h-48">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
