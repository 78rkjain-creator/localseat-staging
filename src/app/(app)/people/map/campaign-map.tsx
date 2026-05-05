"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CampaignMapFeature } from "@/lib/map";
import { PinDropPanel } from "./pin-drop-panel";
import type { PinAddress, PinDropSuccess } from "./pin-drop-panel";

// ── Constants ──────────────────────────────────────────────────────────────

type LevelKey = "strong_yes" | "soft_yes" | "undecided" | "soft_no" | "strong_no" | "not_home" | "none";

const LEVEL_COLORS: Record<LevelKey, string> = {
  strong_yes: "#10b981",
  soft_yes:   "#34d399",
  undecided:  "#f59e0b",
  soft_no:    "#f97316",
  strong_no:  "#ef4444",
  not_home:   "#94a3b8",
  none:       "#cbd5e1",
};

const LEVEL_LABELS: Record<LevelKey, string> = {
  strong_yes: "Strong Support",
  soft_yes:   "Soft Support",
  undecided:  "Undecided",
  soft_no:    "Soft No",
  strong_no:  "Strong No",
  not_home:   "Not home",
  none:       "Not contacted",
};

const ALL_LEVEL_KEYS: LevelKey[] = [
  "strong_yes", "soft_yes", "undecided", "soft_no", "strong_no", "not_home", "none",
];

type EnabledLevels = Record<LevelKey, boolean>;

const ALL_ENABLED: EnabledLevels = {
  strong_yes: true, soft_yes: true, undecided: true,
  soft_no: true, strong_no: true, not_home: true, none: true,
};

// ── Props ──────────────────────────────────────────────────────────────────

interface OfficePin {
  lat: number;
  lng: number;
  address: string;
}

interface Props {
  features: CampaignMapFeature[];
  wardBoundary: unknown | null;
  campaignId: string;
  totalCount: number;
  canCreate: boolean;
  officePin?: OfficePin | null;
}

// ── Reverse geocode (client-side Mapbox API) ───────────────────────────────

async function reverseGeocode(lng: number, lat: number, token: string): Promise<PinAddress | null> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=address&country=ca&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as { features?: any[] };
    const f = data.features?.[0];
    if (!f) return null;

    const streetNumber: string = f.address ?? "";
    const streetName: string = f.text ?? "";
    let city = "", province = "ON", postalCode = "";

    for (const ctx of (f.context ?? []) as { id: string; text: string; short_code?: string }[]) {
      if (ctx.id.startsWith("place."))    city = ctx.text;
      if (ctx.id.startsWith("postcode.")) postalCode = ctx.text.replace(/\s/g, "");
      if (ctx.id.startsWith("region."))   province = ctx.short_code?.split("-")[1] ?? "ON";
    }

    return { streetNumber, streetName, unitNumber: "", city, province, postalCode };
  } catch {
    return null;
  }
}

// ── GeoJSON overlay validation ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPolygonFeature(f: any): boolean {
  if (!f || f.type !== "Feature") return false;
  const g = f.geometry;
  return g?.type === "Polygon" || g?.type === "MultiPolygon";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseOverlay(raw: any): GeoJSON.FeatureCollection | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "FeatureCollection") {
    const ok = Array.isArray(raw.features) && raw.features.every(isPolygonFeature);
    return ok ? raw : null;
  }
  if (raw.type === "Feature" && isPolygonFeature(raw)) {
    return { type: "FeatureCollection", features: [raw] };
  }
  return null;
}

// ── Mapbox filter helper ───────────────────────────────────────────────────

function buildFilter(enabled: EnabledLevels): unknown[] {
  const keys = ALL_LEVEL_KEYS.filter((k) => enabled[k]);
  if (keys.length === 0) return ["==", "1", "2"]; // always false
  if (keys.length === ALL_LEVEL_KEYS.length) return ["!=", "1", "2"]; // always true
  return ["any", ...keys.map((k) => ["==", ["get", "levelKey"], k])];
}

// ── Mapbox color expression ────────────────────────────────────────────────

function colorExpression(): unknown[] {
  // match expression: ["match", input, v1, out1, v2, out2, ..., fallback]
  const pairs: unknown[] = [];
  for (const [key, color] of Object.entries(LEVEL_COLORS)) {
    pairs.push(key, color);
  }
  return ["match", ["get", "levelKey"], ...pairs, "#cbd5e1"];
}

// ── Main component ─────────────────────────────────────────────────────────

export function CampaignMapClient({ features, wardBoundary, campaignId, totalCount, canCreate, officePin }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tempMarkerRef = useRef<any>(null);
  const mapReadyRef = useRef(false);
  const canCreateRef = useRef(canCreate);

  // Mutable GeoJSON feature list — updated when pin-drop creates a new contact
  type GeoFeat = {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { personId: string; name: string; address: string; supportLevel: string; outcome: string; levelKey: string };
  };
  const mapGeoFeaturesRef = useRef<GeoFeat[]>(
    features.map((f) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [f.lng, f.lat] as [number, number] },
      properties: {
        personId: f.personId,
        name: f.name,
        address: f.address ?? "",
        supportLevel: f.supportLevel ?? "",
        outcome: (f.outcome ?? "") as string,
        levelKey: f.levelKey,
      },
    }))
  );

  // Layer visibility
  const [enabled, setEnabled] = useState<EnabledLevels>(ALL_ENABLED);
  const [wardVisible, setWardVisible] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(true);

  // Overlay state
  const [overlayData, setOverlayData] = useState<GeoJSON.FeatureCollection | null>(null);
  const overlayDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Pin-drop state
  const [pinDrop, setPinDrop] = useState<{ lng: number; lat: number } | null>(null);
  const [pinAddress, setPinAddress] = useState<PinAddress | null>(null);
  const [pinGeocoding, setPinGeocoding] = useState(false);

  const OVERLAY_KEY = `localseat_map_overlay_${campaignId}`;

  // Load persisted overlay from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(OVERLAY_KEY);
      if (stored) {
        const parsed = normaliseOverlay(JSON.parse(stored));
        if (parsed) {
          overlayDataRef.current = parsed;
          setOverlayData(parsed);
        }
      }
    } catch {
      // corrupt localStorage entry — silently discard
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Map initialisation ─────────────────────────────────────────────────

  const center: [number, number] =
    features.length > 0
      ? [
          features.reduce((s, f) => s + f.lng, 0) / features.length,
          features.reduce((s, f) => s + f.lat, 0) / features.length,
        ]
      : [-79.3832, 43.6532];

  useEffect(() => {
    if (!mapContainer.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any;

    Promise.all([
      import("mapbox-gl"),
      import("mapbox-gl/dist/mapbox-gl.css"),
    ]).then(([mapboxgl]) => {
      mapboxgl.default.accessToken = token;

      map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center,
        zoom: 13,
      });

      mapRef.current = map;

      map.on("load", () => {
        // ── Ward boundary ────────────────────────────────────────────
        if (wardBoundary) {
          // Dashed outline only — no fill mask on the campaign-wide map
          map.addSource("ward-boundary", {
            type: "geojson",
            data: { type: "Feature", geometry: wardBoundary, properties: {} },
          });
          map.addLayer({
            id: "ward-line",
            type: "line",
            source: "ward-boundary",
            paint: {
              "line-color": "#334155",
              "line-width": 2.5,
              "line-dasharray": [4, 3],
            },
          });
        }

        // ── GeoJSON overlay (persisted) ──────────────────────────────
        const initialOverlay = overlayDataRef.current;
        map.addSource("overlay", {
          type: "geojson",
          data: initialOverlay ?? { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "overlay-fill",
          type: "fill",
          source: "overlay",
          paint: { "fill-color": "#6366f1", "fill-opacity": 0.18 },
        });
        map.addLayer({
          id: "overlay-line",
          type: "line",
          source: "overlay",
          paint: { "line-color": "#6366f1", "line-width": 1.5, "line-dasharray": [3, 2] },
        });

        // ── Contact markers ──────────────────────────────────────────
        map.addSource("contacts", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: features.map((f) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [f.lng, f.lat] },
              properties: {
                personId: f.personId,
                name: f.name,
                address: f.address,
                supportLevel: f.supportLevel ?? "",
                outcome: f.outcome ?? "",
                levelKey: f.levelKey,
              },
            })),
          },
        });

        map.addLayer({
          id: "contacts-circle",
          type: "circle",
          source: "contacts",
          paint: {
            "circle-radius": 6,
            "circle-color": colorExpression(),
            "circle-opacity": [
              "match", ["get", "levelKey"],
              "not_home", 0.35,
              0.9,
            ],
            "circle-stroke-width": [
              "match", ["get", "levelKey"],
              "not_home", 2,
              1.5,
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-opacity": [
              "match", ["get", "levelKey"],
              "not_home", 0.7,
              1,
            ],
          },
        });

        // ── Campaign office pin ──────────────────────────────────────
        if (officePin) {
          const el = document.createElement("div");
          el.style.cssText = [
            "width:22px",
            "height:22px",
            "border-radius:5px",
            "background:#8b5cf6",
            "border:3px solid #ffffff",
            "box-shadow:0 2px 6px rgba(0,0,0,0.3)",
            "cursor:pointer",
          ].join(";");

          const officeMarker = new mapboxgl.default.Marker({ element: el })
            .setLngLat([officePin.lng, officePin.lat])
            .addTo(map);

          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            new mapboxgl.default.Popup({ offset: 16, maxWidth: "220px" })
              .setLngLat([officePin.lng, officePin.lat])
              .setHTML(`
                <div style="font-family:system-ui,sans-serif;padding:4px 2px;min-width:160px;">
                  <p style="margin:0 0 2px;font-weight:700;font-size:13px;color:#0f172a;">Campaign office</p>
                  <p style="margin:0;font-size:11px;color:#94a3b8;">${officePin.address}</p>
                </div>
              `)
              .addTo(map);
          });

          // Remove marker on cleanup
          map.once("remove", () => officeMarker.remove());
        }

        // Click → popup
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", "contacts-circle", (e: any) => {
          const props = e.features[0].properties;
          const coords: [number, number] = e.features[0].geometry.coordinates.slice();

          const levelKey = props.levelKey as LevelKey;
          const levelLabel = LEVEL_LABELS[levelKey] ?? "—";
          const levelColor = LEVEL_COLORS[levelKey] ?? "#94a3b8";

          const supportLine = levelKey !== "none"
            ? `<p style="margin:3px 0 0;font-size:12px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${levelColor};margin-right:4px;vertical-align:middle;"></span>
                <span style="color:#64748b;">${levelLabel}</span>
               </p>`
            : "";

          new mapboxgl.default.Popup({ offset: 10, maxWidth: "220px" })
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family:system-ui,sans-serif;padding:4px 2px;min-width:160px;">
                <p style="margin:0 0 2px;font-weight:700;font-size:13px;color:#0f172a;">${props.name}</p>
                <p style="margin:0;font-size:11px;color:#94a3b8;">${props.address || "Address unknown"}</p>
                ${supportLine}
                <a href="/people/${props.personId}"
                   style="display:inline-block;margin-top:8px;font-size:12px;color:#f97316;text-decoration:none;font-weight:600;">
                  View profile →
                </a>
              </div>
            `)
            .addTo(map);
        });

        map.on("mouseenter", "contacts-circle", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "contacts-circle", () => {
          map.getCanvas().style.cursor = "";
        });

        // ── Pin drop — click on empty map area ──────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", (e: any) => {
          if (!canCreateRef.current) return;
          // Ignore if a contact marker was clicked (that handler fires first)
          const hit = map.queryRenderedFeatures(e.point, { layers: ["contacts-circle"] });
          if (hit.length > 0) return;

          const { lng, lat } = e.lngLat;

          // Move / place temporary orange pin
          if (tempMarkerRef.current) tempMarkerRef.current.remove();
          tempMarkerRef.current = new mapboxgl.default.Marker({ color: "#f97316" })
            .setLngLat([lng, lat])
            .addTo(map);

          setPinDrop({ lng, lat });
          setPinAddress(null);
          setPinGeocoding(true);

          reverseGeocode(lng, lat, token).then((addr) => {
            setPinAddress(addr);
            setPinGeocoding(false);
          });
        });

        mapReadyRef.current = true;
      });
    });

    return () => {
      mapReadyRef.current = false;
      tempMarkerRef.current?.remove();
      tempMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync enabled levels to map filter ─────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !mapReadyRef.current) return;
    mapRef.current.setFilter("contacts-circle", buildFilter(enabled));
  }, [enabled]);

  // ── Sync ward visibility ───────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !mapReadyRef.current || !wardBoundary) return;
    const vis = wardVisible ? "visible" : "none";
    mapRef.current.setLayoutProperty("ward-line", "visibility", vis);
  }, [wardVisible, wardBoundary]);

  // ── Sync overlay visibility ────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !mapReadyRef.current) return;
    const vis = overlayVisible ? "visible" : "none";
    mapRef.current.setLayoutProperty("overlay-fill", "visibility", vis);
    mapRef.current.setLayoutProperty("overlay-line", "visibility", vis);
  }, [overlayVisible]);

  // ── Sync overlay data to map source ───────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !mapReadyRef.current) return;
    const src = mapRef.current.getSource("overlay");
    if (!src) return;
    src.setData(overlayData ?? { type: "FeatureCollection", features: [] });
  }, [overlayData]);

  // ── Overlay file import ────────────────────────────────────────────────

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setOverlayError(null);

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const raw = JSON.parse(ev.target?.result as string);
          const fc = normaliseOverlay(raw);
          if (!fc) {
            setOverlayError("File must be GeoJSON with Polygon or MultiPolygon features.");
            return;
          }
          overlayDataRef.current = fc;
          setOverlayData(fc);
          setOverlayVisible(true);
          localStorage.setItem(OVERLAY_KEY, JSON.stringify(fc));
        } catch {
          setOverlayError("Could not parse file as GeoJSON.");
        }
      };
      reader.readAsText(file);
      // Reset so re-uploading same file triggers onChange
      e.target.value = "";
    },
    [OVERLAY_KEY]
  );

  const clearOverlay = useCallback(() => {
    overlayDataRef.current = null;
    setOverlayData(null);
    localStorage.removeItem(OVERLAY_KEY);
  }, [OVERLAY_KEY]);

  // ── Pin drop callbacks ─────────────────────────────────────────────────────

  const cancelPinDrop = useCallback(() => {
    tempMarkerRef.current?.remove();
    tempMarkerRef.current = null;
    setPinDrop(null);
    setPinAddress(null);
    setPinGeocoding(false);
  }, []);

  const handlePinDropSuccess = useCallback((result: PinDropSuccess) => {
    const newFeat = {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [result.lng, result.lat] as [number, number] },
      properties: {
        personId: result.personId,
        name: result.name,
        address: result.address,
        supportLevel: "",
        outcome: "",
        levelKey: "none",
      },
    };
    mapGeoFeaturesRef.current = [...mapGeoFeaturesRef.current, newFeat];
    const src = mapRef.current?.getSource("contacts");
    if (src) {
      src.setData({ type: "FeatureCollection", features: mapGeoFeaturesRef.current });
    }
    tempMarkerRef.current?.remove();
    tempMarkerRef.current = null;
    setPinDrop(null);
    setPinAddress(null);
    setPinGeocoding(false);
  }, []);

  // ── Level counts ───────────────────────────────────────────────────────

  const levelCounts = features.reduce<Record<string, number>>((acc, f) => {
    acc[f.levelKey] = (acc[f.levelKey] ?? 0) + 1;
    return acc;
  }, {});

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-4 flex-wrap">
        <a
          href="/people"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 flex-shrink-0"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">People</span>
        </a>

        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide hidden sm:inline">Contact Map</span>

        <div className="flex items-center gap-4 ml-auto text-sm">
          {canCreate && !pinDrop && (
            <span className="hidden sm:inline text-xs text-slate-400">Click map to add contact</span>
          )}
          {pinDrop && (
            <button
              type="button"
              onClick={cancelPinDrop}
              className="text-xs text-brand-600 font-medium hover:text-brand-700"
            >
              Cancel pin
            </button>
          )}
          <span className="text-slate-500">{totalCount.toLocaleString()} mapped</span>
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {panelOpen ? "Hide filters" : "Filters"}
          </button>
        </div>
      </div>

      {/* ── Map area ── */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div ref={mapContainer} className="w-full h-full" />

        {/* ── Control panel (top-right) ── */}
        {panelOpen && (
          <div className="absolute top-3 right-3 z-10 w-52 bg-white/97 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-md overflow-hidden">

            {/* Support levels */}
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Layers</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEnabled(ALL_ENABLED)}
                    className="text-[10px] text-brand-600 hover:text-brand-700 font-medium"
                  >
                    All
                  </button>
                  <span className="text-slate-200">|</span>
                  <button
                    type="button"
                    onClick={() => setEnabled(Object.fromEntries(ALL_LEVEL_KEYS.map((k) => [k, false])) as EnabledLevels)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-medium"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                {ALL_LEVEL_KEYS.map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={enabled[key]}
                      onChange={(e) =>
                        setEnabled((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="rounded border-slate-300 text-brand-500 focus:ring-brand-500 h-3.5 w-3.5 flex-shrink-0"
                    />
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0 border border-white shadow-sm"
                      style={{
                        backgroundColor: LEVEL_COLORS[key],
                        opacity: key === "not_home" ? 0.5 : 1,
                      }}
                    />
                    <span className="text-xs text-slate-700 flex-1 truncate">{LEVEL_LABELS[key]}</span>
                    <span className="text-[10px] text-slate-400 tabular flex-shrink-0">
                      {levelCounts[key] ?? 0}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Ward boundary toggle */}
            {wardBoundary != null && (
              <div className="border-t border-slate-100 px-3 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Overlays</p>
                <label className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wardVisible}
                    onChange={(e) => setWardVisible(e.target.checked)}
                    className="rounded border-slate-300 text-brand-500 focus:ring-brand-500 h-3.5 w-3.5 flex-shrink-0"
                  />
                  <span className="text-xs text-slate-700">Ward boundary</span>
                </label>
              </div>
            )}

            {/* GeoJSON overlay section */}
            <div className={["border-t border-slate-100 px-3 py-2.5", wardBoundary ? "" : "border-t"].join(" ")}>
              {!wardBoundary && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Overlays</p>
              )}
              {overlayData ? (
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overlayVisible}
                      onChange={(e) => setOverlayVisible(e.target.checked)}
                      className="rounded border-slate-300 text-brand-500 focus:ring-brand-500 h-3.5 w-3.5 flex-shrink-0"
                    />
                    <span
                      className="h-2.5 w-2.5 rounded flex-shrink-0 border border-indigo-400"
                      style={{ backgroundColor: "rgba(99,102,241,0.25)" }}
                    />
                    <span className="text-xs text-slate-700 flex-1 truncate">Imported overlay</span>
                  </label>
                  <button
                    type="button"
                    onClick={clearOverlay}
                    className="text-[11px] text-red-400 hover:text-red-600 font-medium text-left px-1 transition-colors"
                  >
                    Remove overlay
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 h-7 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import GeoJSON overlay
                </button>
              )}
              {overlayError && (
                <p className="text-[10px] text-red-500 mt-1 px-1">{overlayError}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Legend (bottom-left) ── */}
        <div className="absolute bottom-8 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm px-3 py-2.5 flex flex-col gap-1.5">
          {ALL_LEVEL_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full flex-shrink-0 border border-white shadow-sm"
                style={{
                  backgroundColor: LEVEL_COLORS[key],
                  opacity: key === "not_home" ? 0.45 : 1,
                }}
              />
              <span className="text-xs text-slate-600">{LEVEL_LABELS[key]}</span>
            </div>
          ))}
          {officePin && (
            <div className="flex items-center gap-2 pt-1 mt-0.5 border-t border-slate-100">
              <span
                className="h-3 w-3 rounded flex-shrink-0 border border-white shadow-sm flex-none"
                style={{ backgroundColor: "#8b5cf6" }}
              />
              <span className="text-xs text-slate-600">Campaign office</span>
            </div>
          )}
        </div>
      </div>

      {/* Pin drop form panel */}
      {pinDrop && (
        <PinDropPanel
          lat={pinDrop.lat}
          lng={pinDrop.lng}
          initialAddress={pinAddress}
          geocoding={pinGeocoding}
          onSuccess={handlePinDropSuccess}
          onCancel={cancelPinDrop}
        />
      )}

      {/* Hidden file input for overlay import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".geojson,.json"
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  );
}
