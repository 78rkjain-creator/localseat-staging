"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Polygon, MultiPolygon } from "geojson";
import { parseKmlToGeoJsonPolygon } from "@/lib/ward";
import { saveWardBoundary, clearWardBoundary } from "./actions";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// ── Geometry helpers ──────────────────────────────────────────────────────────

function getBoundsFromGeometry(
  geometry: Polygon | MultiPolygon
): { minLng: number; maxLng: number; minLat: number; maxLat: number } | null {
  const allCoords: number[][] = [];

  if (geometry.type === "Polygon") {
    const ring = geometry.coordinates[0];
    if (ring) allCoords.push(...ring);
  } else {
    for (const poly of geometry.coordinates) {
      const ring = poly[0];
      if (ring) allCoords.push(...ring);
    }
  }

  if (allCoords.length === 0) return null;

  const lngs = allCoords.map((c) => c[0]).filter((v): v is number => v !== undefined);
  const lats = allCoords.map((c) => c[1]).filter((v): v is number => v !== undefined);

  if (lngs.length === 0 || lats.length === 0) return null;
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  wardBoundary: Polygon | MultiPolygon | null;
  wardBoundarySetAt: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WardMapClient({ wardBoundary, wardBoundarySetAt }: Props) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawRef = useRef<any>(null);

  // ── State ─────────────────────────────────────────────────────────────────

  const [currentPolygon, setCurrentPolygon] = useState<Polygon | MultiPolygon | null>(wardBoundary);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [hasUnsavedBoundary, setHasUnsavedBoundary] = useState(false);
  const [showNavModal, setShowNavModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasUnsavedRef = useRef(false);
  const pendingNavRef = useRef<(() => void) | null>(null);

  // ── Unsaved boundary guards ───────────────────────────────────────────────

  // Keep ref in sync with state so event listeners can read it without stale closures
  useEffect(() => { hasUnsavedRef.current = hasUnsavedBoundary; }, [hasUnsavedBoundary]);

  // Browser close / tab refresh guard
  useEffect(() => {
    if (!hasUnsavedBoundary) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedBoundary]);

  // In-app navigation guard — intercept history.pushState (used by Next.js <Link>)
  useEffect(() => {
    const origPush = history.pushState;
    const thisPageUrl = window.location.href;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (history as any).pushState = function(data: unknown, unused: string, url?: string | URL | null) {
      if (hasUnsavedRef.current) {
        const rawUrl = url ? url.toString() : "";
        const path = rawUrl.startsWith(window.location.origin)
          ? rawUrl.slice(window.location.origin.length)
          : rawUrl;
        pendingNavRef.current = () => {
          hasUnsavedRef.current = false;
          if (path) router.push(path);
          else origPush.call(history, data, unused, url);
        };
        setShowNavModal(true);
      } else {
        origPush.call(history, data, unused, url);
      }
    };

    const handlePopstate = () => {
      if (!hasUnsavedRef.current) return;
      const targetPath = window.location.pathname + window.location.search;
      origPush.call(history, null, "", thisPageUrl);
      pendingNavRef.current = () => {
        hasUnsavedRef.current = false;
        router.push(targetPath);
      };
      setShowNavModal(true);
    };

    window.addEventListener("popstate", handlePopstate);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (history as any).pushState = origPush;
      window.removeEventListener("popstate", handlePopstate);
    };
  }, [router]);

  // ── Load a Polygon or MultiPolygon onto the draw control and fit bounds ───

  function loadGeometryOntoMap(geometry: Polygon | MultiPolygon) {
    const draw = drawRef.current;
    const map  = mapRef.current;
    if (!draw) return;

    draw.deleteAll();
    if (geometry.type === "Polygon") {
      draw.add({ type: "Feature", geometry, properties: {} });
    } else {
      // MapboxGL Draw works with individual Polygons — add each ring separately
      for (const polyCoords of geometry.coordinates) {
        draw.add({ type: "Feature", geometry: { type: "Polygon", coordinates: polyCoords }, properties: {} });
      }
    }

    const bounds = getBoundsFromGeometry(geometry);
    if (bounds && map) {
      map.fitBounds(
        [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
        { padding: 60 }
      );
    }
  }

  // ── Polygon evaluation (called from draw events) ──────────────────────────

  const evaluatePolygon = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (draw: any) => {
      if (!draw) { setCurrentPolygon(null); return; }
      const features: { geometry: { type: string; coordinates: unknown } }[] =
        draw.getAll()?.features ?? [];
      const polygons = features.filter((f) => f.geometry.type === "Polygon");

      if (polygons.length === 0) {
        setCurrentPolygon(null);
      } else if (polygons.length === 1) {
        const p = polygons[0]!;
        setCurrentPolygon({ type: "Polygon", coordinates: p.geometry.coordinates as Polygon["coordinates"] });
      } else {
        setCurrentPolygon({
          type: "MultiPolygon",
          coordinates: polygons.map((p) => p.geometry.coordinates as Polygon["coordinates"]),
        });
      }
    },
    []
  );

  // ── Map initialisation ────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapContainer.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) { console.error("[WardMap] NEXT_PUBLIC_MAPBOX_TOKEN is not set"); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let draw: any;

    Promise.all([
      import("mapbox-gl"),
      import("mapbox-gl/dist/mapbox-gl.css"),
      import("@mapbox/mapbox-gl-draw"),
    ]).then(([mapboxgl, , MapboxDraw]) => {
      mapboxgl.default.accessToken = token;

      map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-80.9432, 44.5676],
        zoom: 13,
      });

      mapRef.current = map;

      draw = new MapboxDraw.default({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: "simple_select",
        styles: [
          {
            id: "gl-draw-polygon-fill",
            type: "fill",
            filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
            paint: { "fill-color": "#F26522", "fill-opacity": 0.15 },
          },
          {
            id: "gl-draw-polygon-stroke",
            type: "line",
            filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#F26522", "line-width": 3, "line-opacity": 1 },
          },
          {
            id: "gl-draw-polygon-and-line-vertex-active",
            type: "circle",
            filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
            paint: { "circle-radius": 7, "circle-color": "#ffffff", "circle-stroke-color": "#F26522", "circle-stroke-width": 2.5 },
          },
          {
            id: "gl-draw-polygon-midpoint",
            type: "circle",
            filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
            paint: { "circle-radius": 4, "circle-color": "#F26522", "circle-opacity": 0.6 },
          },
          {
            id: "gl-draw-line-active",
            type: "line",
            filter: ["all", ["==", "$type", "LineString"], ["==", "active", "true"]],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#F26522", "line-width": 2.5, "line-dasharray": [4, 2] },
          },
        ],
      });

      drawRef.current = draw;
      map.addControl(draw, "top-right");

      map.on("load", () => {
        if (wardBoundary) {
          if (wardBoundary.type === "Polygon") {
            draw.add({ type: "Feature", geometry: wardBoundary, properties: {} });
          } else {
            for (const polyCoords of wardBoundary.coordinates) {
              draw.add({ type: "Feature", geometry: { type: "Polygon", coordinates: polyCoords }, properties: {} });
            }
          }
          const bounds = getBoundsFromGeometry(wardBoundary);
          if (bounds) {
            map.fitBounds([[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]], { padding: 60 });
          }
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onUpdate = (_e: any) => { setHasUnsavedBoundary(true); evaluatePolygon(draw); };
      map.on("draw.create", () => { setIsDrawing(false); setHasUnsavedBoundary(true); evaluatePolygon(draw); });
      map.on("draw.update", onUpdate);
      map.on("draw.delete", () => {
        setIsDrawing(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const remaining = (draw.getAll()?.features ?? []).filter((f: any) => f.geometry?.type === "Polygon");
        if (remaining.length === 0) setHasUnsavedBoundary(false);
        evaluatePolygon(draw);
      });
    });

    return () => {
      setIsDrawing(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toolbar handlers ──────────────────────────────────────────────────────

  function handleDrawBoundary() {
    if (!drawRef.current) return;
    if (isDrawing) {
      drawRef.current.changeMode("simple_select");
      setIsDrawing(false);
      return;
    }
    drawRef.current.deleteAll();
    setCurrentPolygon(null);
    setIsDrawing(true);
    drawRef.current.changeMode("draw_polygon");
  }

  function handleClear() {
    if (!drawRef.current) return;
    drawRef.current.deleteAll();
    setCurrentPolygon(null);
    setIsDrawing(false);
    setSaveMsg(null);
    setHasUnsavedBoundary(false);
  }

  async function handleSave() {
    if (!currentPolygon) return;
    setSaving(true);
    setSaveMsg(null);
    const result = await saveWardBoundary(currentPolygon);
    setSaving(false);
    if (result.error) {
      setSaveMsg({ type: "error", text: result.error });
    } else {
      setSaveMsg({ type: "success", text: "Ward boundary saved." });
      setHasUnsavedBoundary(false);
    }
  }

  async function handleClearAndSave() {
    setSaving(true);
    setSaveMsg(null);
    if (drawRef.current) { drawRef.current.deleteAll(); }
    setCurrentPolygon(null);
    const result = await clearWardBoundary();
    setSaving(false);
    if (result.error) {
      setSaveMsg({ type: "error", text: result.error });
    } else {
      setSaveMsg({ type: "success", text: "Ward boundary cleared." });
      setHasUnsavedBoundary(false);
    }
  }

  // ── Navigation modal handlers ─────────────────────────────────────────────

  async function handleSaveAndLeave() {
    if (!currentPolygon) {
      hasUnsavedRef.current = false;
      setHasUnsavedBoundary(false);
      setShowNavModal(false);
      const nav = pendingNavRef.current;
      pendingNavRef.current = null;
      nav?.();
      return;
    }
    setSaving(true);
    const result = await saveWardBoundary(currentPolygon);
    setSaving(false);
    if (result.error) {
      setSaveMsg({ type: "error", text: result.error });
      setShowNavModal(false);
    } else {
      hasUnsavedRef.current = false;
      setHasUnsavedBoundary(false);
      setShowNavModal(false);
      const nav = pendingNavRef.current;
      pendingNavRef.current = null;
      nav?.();
    }
  }

  function handleLeaveWithoutSaving() {
    hasUnsavedRef.current = false;
    setHasUnsavedBoundary(false);
    setShowNavModal(false);
    const nav = pendingNavRef.current;
    pendingNavRef.current = null;
    nav?.();
  }

  function handleCancelNav() {
    setShowNavModal(false);
    pendingNavRef.current = null;
  }

  // ── File upload ───────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".kmz")) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const buffer = evt.target?.result;
        if (!(buffer instanceof ArrayBuffer)) { setFileError("Could not read file."); return; }

        try {
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(buffer);
          const kmlFile = Object.values(zip.files).find((f) => f.name.endsWith(".kml"));
          if (!kmlFile) { setFileError("No KML file found inside this KMZ."); return; }

          const kmlText = await kmlFile.async("string");
          const poly = parseKmlToGeoJsonPolygon(kmlText);
          if (!poly) { setFileError("Could not parse KML inside KMZ. Make sure it contains a single polygon."); return; }

          loadGeometryOntoMap(poly);
          setCurrentPolygon(poly);
          setHasUnsavedBoundary(true);
          setSaveMsg(null);
        } catch {
          setFileError("Could not read KMZ file.");
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text !== "string") { setFileError("Could not read file."); return; }

      let geometry: Polygon | MultiPolygon | null = null;

      if (file.name.endsWith(".kml")) {
        geometry = parseKmlToGeoJsonPolygon(text);
        if (!geometry) { setFileError("Could not parse KML. Make sure it contains a single polygon."); return; }
      } else {
        // GeoJSON — support Polygon, MultiPolygon, and Feature wrappers
        try {
          const parsed: unknown = JSON.parse(text);
          if (parsed !== null && typeof parsed === "object" && "type" in parsed) {
            const geo = parsed as {
              type: string;
              geometry?: { type: string; coordinates: unknown };
              coordinates?: unknown;
            };
            if (geo.type === "Polygon" && geo.coordinates) {
              geometry = { type: "Polygon", coordinates: geo.coordinates as Polygon["coordinates"] };
            } else if (geo.type === "MultiPolygon" && geo.coordinates) {
              geometry = { type: "MultiPolygon", coordinates: geo.coordinates as MultiPolygon["coordinates"] };
            } else if (geo.type === "Feature" && geo.geometry?.type === "Polygon" && geo.geometry.coordinates) {
              geometry = { type: "Polygon", coordinates: geo.geometry.coordinates as Polygon["coordinates"] };
            } else if (geo.type === "Feature" && geo.geometry?.type === "MultiPolygon" && geo.geometry.coordinates) {
              geometry = { type: "MultiPolygon", coordinates: geo.geometry.coordinates as MultiPolygon["coordinates"] };
            }
          }
        } catch {
          setFileError("Invalid GeoJSON file.");
          return;
        }
        if (!geometry) { setFileError("File must contain a GeoJSON Polygon, MultiPolygon, or Feature."); return; }
      }

      loadGeometryOntoMap(geometry);
      setCurrentPolygon(geometry);
      setHasUnsavedBoundary(true);
      setSaveMsg(null);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasBoundary = currentPolygon !== null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleDrawBoundary}
          className={[
            "inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border text-sm font-medium transition-colors",
            isDrawing
              ? "border-brand-500 bg-brand-500 text-white"
              : "border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300",
          ].join(" ")}
        >
          <svg className={["h-4 w-4", isDrawing ? "text-white" : "text-slate-500"].join(" ")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l-4 1 1-4 9.536-9.536a2 2 0 012.828 0l.707.707a2 2 0 010 2.828L9 13z" />
          </svg>
          Draw boundary
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,.kml,.kmz"
          className="hidden"
          onChange={handleFileChange}
        />

        {hasBoundary && (
          <>
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              Clear
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className={[
                "inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                hasUnsavedBoundary ? "ring-2 ring-brand-300 ring-offset-1" : "",
              ].join(" ")}
            >
              {saving ? "Saving…" : "Save boundary"}
            </button>
          </>
        )}

        {!hasBoundary && wardBoundarySetAt && (
          <button
            onClick={handleClearAndSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Clearing…" : "Remove saved boundary"}
          </button>
        )}
      </div>

      {/* File error */}
      {fileError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {fileError}
        </p>
      )}

      {/* Save message */}
      {saveMsg && (
        <p
          className={[
            "text-xs rounded-xl px-3 py-2 border",
            saveMsg.type === "success"
              ? "text-emerald-700 bg-emerald-50 border-emerald-100"
              : "text-red-600 bg-red-50 border-red-100",
          ].join(" ")}
        >
          {saveMsg.text}
        </p>
      )}

      {/* Status badge when boundary exists and nothing new is drawn */}
      {wardBoundarySetAt && hasBoundary && (
        <p className="text-xs text-slate-500">
          Saved boundary loaded.{" "}
          Last updated{" "}
          {new Date(wardBoundarySetAt).toLocaleDateString("en-CA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          . Draw a new polygon or upload a file to replace it.
        </p>
      )}

      {/* Drawing instruction banner */}
      {isDrawing && (
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
          <svg className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-slate-600"><span className="font-semibold">Click</span> to place each point of your boundary.</p>
            <p className="text-xs text-slate-600"><span className="font-semibold">Double-click</span> to close and finish the shape.</p>
            <p className="text-xs text-slate-600"><span className="font-semibold">Press Escape</span> to cancel.</p>
          </div>
        </div>
      )}

      {/* Unsaved boundary banner */}
      {hasUnsavedBoundary && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <svg className="h-4 w-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.538-1.333-3.308 0L3.732 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-medium text-amber-800">
            You have an unsaved boundary. Click <span className="font-semibold">Save boundary</span> to keep it.
          </p>
        </div>
      )}

      {/* Map */}
      <div
        className="relative rounded-2xl overflow-hidden border border-slate-200"
        style={{ height: "calc(100dvh - 320px)", minHeight: "400px" }}
      >
        <div ref={mapContainer} className="w-full h-full" />
      </div>

      {/* File type helper */}
      <p className="text-xs text-slate-400">
        Accepted file types: .geojson (Polygon or MultiPolygon), .kml, .kmz
      </p>

      {/* Navigation guard modal */}
      {showNavModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Unsaved boundary</h3>
            <p className="text-sm text-slate-500 mb-6">
              You loaded a ward boundary but haven&apos;t saved it. Do you want to save before leaving?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSaveAndLeave}
                disabled={saving}
                className="h-10 w-full rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save and leave"}
              </button>
              <button
                onClick={handleLeaveWithoutSaving}
                className="h-10 w-full rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Leave without saving
              </button>
              <button
                onClick={handleCancelNav}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
