"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createTurfCanvassList } from "../actions";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// ── Types ──────────────────────────────────────────────────────────────────

interface AddressPoint {
  id: string;
  streetNumber: string;
  streetName: string;
  unitNumber: string | null;
  city: string;
  province: string;
  postalCode: string;
  lat: number;
  lng: number;
}

interface Props {
  addresses: AddressPoint[];
  campaignId: string;
  ungeocodedCount: number;
  geocodedCount: number;
  totalCount: number;
  geocodingInProgress: boolean;
}

// ── Point-in-polygon (ray casting) ─────────────────────────────────────────
// Returns true if [lng, lat] falls inside the GeoJSON polygon ring.

function pointInPolygon(point: [number, number], ring: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function addressLabel(a: AddressPoint): string {
  const unit = a.unitNumber ? ` Unit ${a.unitNumber}` : "";
  return `${a.streetNumber} ${a.streetName}${unit}, ${a.city}`;
}

// ── Component ──────────────────────────────────────────────────────────────

export function TurfMapClient({ addresses, campaignId, ungeocodedCount, geocodedCount, totalCount, geocodingInProgress }: Props) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawRef = useRef<any>(null);

  const [selectedAddresses, setSelectedAddresses] = useState<AddressPoint[]>([]);
  const [currentPolygon, setCurrentPolygon]       = useState<object | null>(null);
  const [warningDismissed, setWarningDismissed]   = useState(false);
  const [name, setName]         = useState("");
  const [description, setDesc]  = useState("");
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Auto-refresh every 30s while geocoding is in progress
  useEffect(() => {
    if (!geocodingInProgress) return;
    const timer = setTimeout(() => {
      window.location.reload();
    }, 30_000);
    return () => clearTimeout(timer);
  }, [geocodingInProgress]);

  // Centroid of geocoded addresses, or Toronto fallback
  const center: [number, number] =
    addresses.length > 0
      ? [
          addresses.reduce((s, a) => s + a.lng, 0) / addresses.length,
          addresses.reduce((s, a) => s + a.lat, 0) / addresses.length,
        ]
      : [-79.3832, 43.6532];

  const evaluatePolygon = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (feature: any) => {
      if (!feature || feature.geometry?.type !== "Polygon") {
        setSelectedAddresses([]);
        setCurrentPolygon(null);
        return;
      }
      const ring: [number, number][] = feature.geometry.coordinates[0];
      const hits = addresses.filter((a) => pointInPolygon([a.lng, a.lat], ring));
      setSelectedAddresses(hits);
      setCurrentPolygon(feature.geometry);
    },
    [addresses]
  );

  useEffect(() => {
    if (!mapContainer.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("[TurfMap] NEXT_PUBLIC_MAPBOX_TOKEN is not set");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let draw: any;

    // Dynamic import keeps mapbox-gl out of the server bundle.
    // CSS is imported from the npm package to guarantee version alignment.
    Promise.all([
      import("mapbox-gl"),
      import("mapbox-gl/dist/mapbox-gl.css"),
      import("@mapbox/mapbox-gl-draw"),
    ]).then(([mapboxgl, , MapboxDraw]) => {
      mapboxgl.default.accessToken = token;

      map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center,
        zoom: 13,
      });

      mapRef.current = map;

      draw = new MapboxDraw.default({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
        defaultMode: "simple_select",
        styles: [
          // Filled polygon
          {
            id: "gl-draw-polygon-fill",
            type: "fill",
            filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
            paint: {
              "fill-color": "#F26522",
              "fill-opacity": 0.15,
            },
          },
          // Polygon outline
          {
            id: "gl-draw-polygon-stroke",
            type: "line",
            filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#F26522",
              "line-width": 3,
              "line-opacity": 1,
            },
          },
          // Vertex points
          {
            id: "gl-draw-polygon-and-line-vertex-active",
            type: "circle",
            filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
            paint: {
              "circle-radius": 7,
              "circle-color": "#ffffff",
              "circle-stroke-color": "#F26522",
              "circle-stroke-width": 2.5,
            },
          },
          // Midpoint handles
          {
            id: "gl-draw-polygon-midpoint",
            type: "circle",
            filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
            paint: {
              "circle-radius": 4,
              "circle-color": "#F26522",
              "circle-opacity": 0.6,
            },
          },
          // Active line while drawing
          {
            id: "gl-draw-line-active",
            type: "line",
            filter: ["all", ["==", "$type", "LineString"], ["==", "active", "true"]],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#F26522",
              "line-width": 2.5,
              "line-dasharray": [4, 2],
            },
          },
        ],
      });

      drawRef.current = draw;
      map.addControl(draw, "top-right");

      map.on("load", () => {
        // Add address points source
        map.addSource("addresses", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: addresses.map((a) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [a.lng, a.lat] },
              properties: { id: a.id, label: addressLabel(a) },
            })),
          },
        });

        map.addLayer({
          id: "address-points",
          type: "circle",
          source: "addresses",
          paint: {
            "circle-radius": 5,
            "circle-color": "#f97316",   // brand orange
            "circle-opacity": 0.85,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
          },
        });
      });

      // Evaluate polygon on draw/update/delete
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onUpdate = (e: any) => {
        const features = draw.getAll()?.features ?? [];
        evaluatePolygon(features[0] ?? null);
        void e;
      };

      map.on("draw.create", onUpdate);
      map.on("draw.update", onUpdate);
      map.on("draw.delete", () => {
        setSelectedAddresses([]);
        setCurrentPolygon(null);
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-evaluate when addresses change (shouldn't change, but safety)
  useEffect(() => {
    if (!drawRef.current) return;
    const features = drawRef.current.getAll()?.features ?? [];
    evaluatePolygon(features[0] ?? null);
  }, [evaluatePolygon]);

  async function handleSave() {
    if (!currentPolygon || !name.trim() || selectedAddresses.length === 0) return;
    setSaveError(null);
    setSaving(true);

    const result = await createTurfCanvassList({
      name: name.trim(),
      description: description.trim() || undefined,
      polygon: currentPolygon,
      addressIds: selectedAddresses.map((a) => a.id),
    });

    if (result.error) {
      setSaveError(result.error);
      setSaving(false);
      return;
    }

    router.push(`/canvassing/${result.listId}`);
  }

  const hasPoly     = currentPolygon !== null;
  const hasSelected = selectedAddresses.length > 0;
  const canSave     = hasPoly && hasSelected && name.trim().length > 0 && !saving;

  const unmappedCount = totalCount - geocodedCount;

  return (
    <div className="flex flex-col" style={{ height: "100dvh", paddingTop: "64px" }}>
      {/* Ungeocoded warning */}
      {(geocodingInProgress || unmappedCount > 0) && !warningDismissed && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-sm text-amber-800 flex-shrink-0">
          {geocodingInProgress ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Map data is being prepared — {geocodedCount} of {totalCount} addresses geocoded. The map will update automatically.
            </span>
          ) : (
            <span>
              <strong>{unmappedCount}</strong> address{unmappedCount !== 1 ? "es" : ""} in your campaign
              haven&apos;t been mapped yet and won&apos;t appear on this map.
            </span>
          )}
          {!geocodingInProgress && (
            <button
              onClick={() => setWarningDismissed(true)}
              className="flex-shrink-0 text-amber-600 hover:text-amber-800 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Map + side panel */}
      <div className="flex flex-1 min-h-0">
        {/* Map */}
        <div
          ref={mapContainer}
          className="flex-1"
          style={{ minHeight: 0 }}
        />

        {/* Side panel */}
        <div className="w-72 flex-shrink-0 bg-white border-l border-slate-100 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="px-4 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Draw turf</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Use the polygon tool on the map to select an area.
            </p>
          </div>

          {/* Selection feedback */}
          <div className="px-4 py-4 border-b border-slate-100 flex-shrink-0">
            {!hasPoly ? (
              <p className="text-sm text-slate-400">No polygon drawn yet.</p>
            ) : !hasSelected ? (
              <p className="text-sm text-amber-600">
                No addresses in this area — try a larger polygon.
              </p>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-2">
                  {selectedAddresses.length} address{selectedAddresses.length !== 1 ? "es" : ""} selected
                </p>
                <ul className="flex flex-col gap-1">
                  {selectedAddresses.slice(0, 5).map((a) => (
                    <li key={a.id} className="text-xs text-slate-600 truncate">
                      {addressLabel(a)}
                    </li>
                  ))}
                  {selectedAddresses.length > 5 && (
                    <li className="text-xs text-slate-400">
                      +{selectedAddresses.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Save form — only shown when polygon is drawn and addresses selected */}
          {hasPoly && hasSelected && (
            <div className="px-4 py-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-700">
                  Walk list name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ward 3 North"
                  maxLength={120}
                  className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-700">
                  Description <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Notes about this area"
                  maxLength={255}
                  className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              {saveError && (
                <p className="text-xs text-red-600 rounded-xl bg-red-50 border border-red-100 px-3 py-2">
                  {saveError}
                </p>
              )}

              <button
                onClick={handleSave}
                disabled={!canSave}
                className="h-11 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Creating…
                  </>
                ) : (
                  "Create walk list"
                )}
              </button>
            </div>
          )}

          {/* Empty state footer */}
          {addresses.length === 0 && (
            <div className="px-4 py-4 mt-auto">
              <p className="text-xs text-slate-400 text-center">
                No geocoded addresses yet. Import addresses and run geocoding before using the map.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
