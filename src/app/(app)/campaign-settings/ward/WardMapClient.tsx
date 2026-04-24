"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Polygon } from "geojson";
import { parseKmlToGeoJsonPolygon } from "@/lib/ward";
import { saveWardBoundary, clearWardBoundary } from "./actions";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

interface Props {
  wardBoundary: Polygon | null;
  wardBoundarySetAt: string | null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WardMapClient({ wardBoundary, wardBoundarySetAt }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawRef = useRef<any>(null);

  const [currentPolygon, setCurrentPolygon] = useState<Polygon | null>(wardBoundary);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Polygon evaluation ────────────────────────────────────────────────────

  const evaluatePolygon = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (draw: any) => {
      if (!draw) { setCurrentPolygon(null); return; }
      const features: { geometry: { type: string; coordinates: Polygon["coordinates"] } }[] =
        draw.getAll()?.features ?? [];
      const first = features[0];
      if (!first || first.geometry.type !== "Polygon") {
        setCurrentPolygon(null);
        return;
      }
      setCurrentPolygon({ type: "Polygon", coordinates: first.geometry.coordinates });
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
        center: [-80.9432, 44.5676], // Owen Sound default
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
        // Load existing boundary onto the map
        if (wardBoundary) {
          draw.add({ type: "Feature", geometry: wardBoundary, properties: {} });
          // Fit the map to the boundary
          const coords = wardBoundary.coordinates[0];
          if (coords && coords.length > 0) {
            const lngs = coords.map((c) => c[0]).filter((v): v is number => v !== undefined);
            const lats = coords.map((c) => c[1]).filter((v): v is number => v !== undefined);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60 });
          }
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onUpdate = (_e: any) => { evaluatePolygon(draw); };
      map.on("draw.create", () => { setIsDrawing(false); evaluatePolygon(draw); });
      map.on("draw.update", onUpdate);
      map.on("draw.delete", () => { setCurrentPolygon(null); setIsDrawing(false); });
    });

    return () => {
      setIsDrawing(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Button handlers ───────────────────────────────────────────────────────

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
    }
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
          const polygon = parseKmlToGeoJsonPolygon(kmlText);
          if (!polygon) { setFileError("Could not parse KML inside KMZ. Make sure it contains a single polygon."); return; }

          if (drawRef.current) {
            drawRef.current.deleteAll();
            drawRef.current.add({ type: "Feature", geometry: polygon, properties: {} });

            const coords = polygon.coordinates[0];
            if (coords && coords.length > 0 && mapRef.current) {
              const lngs = coords.map((c) => c[0]).filter((v): v is number => v !== undefined);
              const lats = coords.map((c) => c[1]).filter((v): v is number => v !== undefined);
              mapRef.current.fitBounds(
                [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                { padding: 60 }
              );
            }
          }
          setCurrentPolygon(polygon);
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

      let polygon: Polygon | null = null;

      if (file.name.endsWith(".kml")) {
        polygon = parseKmlToGeoJsonPolygon(text);
        if (!polygon) { setFileError("Could not parse KML. Make sure it contains a single polygon."); return; }
      } else {
        // GeoJSON
        try {
          const parsed: unknown = JSON.parse(text);
          if (
            parsed !== null &&
            typeof parsed === "object" &&
            "type" in parsed
          ) {
            const geo = parsed as { type: string; geometry?: { type: string; coordinates: Polygon["coordinates"] }; coordinates?: Polygon["coordinates"] };
            if (geo.type === "Polygon" && geo.coordinates) {
              polygon = { type: "Polygon", coordinates: geo.coordinates };
            } else if (geo.type === "Feature" && geo.geometry?.type === "Polygon" && geo.geometry.coordinates) {
              polygon = { type: "Polygon", coordinates: geo.geometry.coordinates };
            }
          }
        } catch {
          setFileError("Invalid GeoJSON file.");
          return;
        }
        if (!polygon) { setFileError("File must contain a GeoJSON Polygon or Feature."); return; }
      }

      // Load onto map
      if (drawRef.current) {
        drawRef.current.deleteAll();
        drawRef.current.add({ type: "Feature", geometry: polygon, properties: {} });

        // Fit bounds
        const coords = polygon.coordinates[0];
        if (coords && coords.length > 0 && mapRef.current) {
          const lngs = coords.map((c) => c[0]).filter((v): v is number => v !== undefined);
          const lats = coords.map((c) => c[1]).filter((v): v is number => v !== undefined);
          mapRef.current.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 60 }
          );
        }
      }
      setCurrentPolygon(polygon);
      setSaveMsg(null);
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-uploaded if needed
    e.target.value = "";
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const hasBoundary = currentPolygon !== null;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
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
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

      {/* Map */}
      <div
        className="relative rounded-2xl overflow-hidden border border-slate-200"
        style={{ height: "calc(100dvh - 320px)", minHeight: "400px" }}
      >
        <div ref={mapContainer} className="w-full h-full" />
      </div>

      <p className="text-xs text-slate-400">
        Accepted file types: .geojson, .kml, .kmz (single polygon only)
      </p>
    </div>
  );
}
