"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Polygon, MultiPolygon } from "geojson";
import { parseKmlToGeoJsonPolygon } from "@/lib/ward";
import { saveWardBoundary, clearWardBoundary } from "./actions";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// ── Represent API types ───────────────────────────────────────────────────────

type RepresentBoundarySet = { name: string; domain: string; slug: string };
type RepresentBoundary    = { name: string; url: string };

// ── Province list ─────────────────────────────────────────────────────────────

const PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
] as const;

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
  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawRef = useRef<any>(null);
  const wardDropdownRef = useRef<HTMLDivElement>(null);

  // ── Map / draw state ──────────────────────────────────────────────────────

  const [currentPolygon, setCurrentPolygon] = useState<Polygon | MultiPolygon | null>(wardBoundary);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Represent API state ───────────────────────────────────────────────────

  const [province,           setProvince]           = useState("");
  const [boundarySets,       setBoundarySets]       = useState<{ label: string; slug: string }[]>([]);
  const [boundarySetSlug,    setBoundarySetSlug]    = useState("");
  const [loadingBoundarySets, setLoadingBoundarySets] = useState(false);
  const [wards,              setWards]              = useState<{ name: string; slug: string }[]>([]);
  const [selectedWardSlugs,  setSelectedWardSlugs]  = useState<string[]>([]);
  const [loadingWards,       setLoadingWards]       = useState(false);
  const [wardDropdownOpen,   setWardDropdownOpen]   = useState(false);
  const [loadingBoundary,    setLoadingBoundary]    = useState(false);
  const [representError,     setRepresentError]     = useState<string | null>(null);

  // ── Click outside ward dropdown ───────────────────────────────────────────

  useEffect(() => {
    if (!wardDropdownOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (wardDropdownRef.current && !wardDropdownRef.current.contains(e.target as Node)) {
        setWardDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [wardDropdownOpen]);

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
      const onUpdate = (_e: any) => { evaluatePolygon(draw); };
      map.on("draw.create", () => { setIsDrawing(false); evaluatePolygon(draw); });
      map.on("draw.update", onUpdate);
      map.on("draw.delete", () => { setIsDrawing(false); evaluatePolygon(draw); });
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

  // ── Represent API handlers ────────────────────────────────────────────────

  async function handleProvinceChange(code: string) {
    setProvince(code);
    setBoundarySetSlug("");
    setBoundarySets([]);
    setWards([]);
    setSelectedWardSlugs([]);
    setRepresentError(null);
    if (!code) return;

    setLoadingBoundarySets(true);
    try {
      const res = await fetch("https://represent.opennorth.ca/boundary-sets/?limit=500");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { objects: RepresentBoundarySet[] };

      // Filter to boundary sets whose domain ends with the province code
      const filtered = data.objects.filter((bs) => {
        const parts = bs.domain.split(",").map((s) => s.trim());
        return parts[parts.length - 1] === code;
      });

      // Group by city name (first segment of domain)
      const cityMap = new Map<string, RepresentBoundarySet[]>();
      for (const bs of filtered) {
        const city = bs.domain.split(",")[0]?.trim() ?? bs.domain;
        const group = cityMap.get(city) ?? [];
        group.push(bs);
        cityMap.set(city, group);
      }

      // Build dropdown items — show city name when unique, boundary set name when ambiguous
      const items: { label: string; slug: string }[] = [];
      for (const [city, sets] of cityMap) {
        if (sets.length === 1) {
          items.push({ label: city, slug: sets[0]!.slug });
        } else {
          for (const bs of sets) {
            items.push({ label: bs.name, slug: bs.slug });
          }
        }
      }

      items.sort((a, b) => a.label.localeCompare(b.label));
      setBoundarySets(items);
    } catch {
      setRepresentError("Could not load municipalities. Check your connection.");
    } finally {
      setLoadingBoundarySets(false);
    }
  }

  async function handleBoundarySetChange(slug: string) {
    setBoundarySetSlug(slug);
    setWards([]);
    setSelectedWardSlugs([]);
    setRepresentError(null);
    if (!slug) return;

    setLoadingWards(true);
    try {
      const res = await fetch(`https://represent.opennorth.ca/boundaries/${slug}/?limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { objects: RepresentBoundary[] };

      const wardItems = data.objects
        .map((w) => {
          // Extract slug from URL e.g. /boundaries/toronto-city-wards/ward-1/
          const parts = w.url.split("/").filter(Boolean);
          const wardSlug = parts[parts.length - 1] ?? "";
          return { name: w.name, slug: wardSlug };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setWards(wardItems);
    } catch {
      setRepresentError("Could not load wards. Check your connection.");
    } finally {
      setLoadingWards(false);
    }
  }

  async function handleLoadBoundary() {
    if (selectedWardSlugs.length === 0 || !boundarySetSlug) return;
    setLoadingBoundary(true);
    setRepresentError(null);

    try {
      const shapes = await Promise.all(
        selectedWardSlugs.map((slug) =>
          fetch(`https://represent.opennorth.ca/boundaries/${boundarySetSlug}/${slug}/simple_shape`)
            .then((r) => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.json() as Promise<Polygon | MultiPolygon>;
            })
        )
      );

      let geometry: Polygon | MultiPolygon;

      if (shapes.length === 1) {
        geometry = shapes[0]!;
      } else {
        // Merge multiple ward shapes into a single MultiPolygon
        const allRings: MultiPolygon["coordinates"] = [];
        for (const shape of shapes) {
          if (shape.type === "Polygon") {
            allRings.push(shape.coordinates);
          } else if (shape.type === "MultiPolygon") {
            allRings.push(...shape.coordinates);
          }
        }
        geometry = { type: "MultiPolygon", coordinates: allRings };
      }

      loadGeometryOntoMap(geometry);
      setCurrentPolygon(geometry);
      setSaveMsg(null);
      setWardDropdownOpen(false);
    } catch {
      setRepresentError("Could not load boundary. Check your connection and try again.");
    } finally {
      setLoadingBoundary(false);
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
          const poly = parseKmlToGeoJsonPolygon(kmlText);
          if (!poly) { setFileError("Could not parse KML inside KMZ. Make sure it contains a single polygon."); return; }

          loadGeometryOntoMap(poly);
          setCurrentPolygon(poly);
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
      setSaveMsg(null);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const hasBoundary = currentPolygon !== null;

  const wardButtonLabel =
    selectedWardSlugs.length === 0
      ? "Select ward"
      : selectedWardSlugs.length === 1
        ? (wards.find((w) => w.slug === selectedWardSlugs[0])?.name ?? "1 ward selected")
        : `${selectedWardSlugs.length} wards selected`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* ── 1. Represent API boundary picker ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <p className="text-sm font-semibold text-slate-800 mb-1">Find boundary by location</p>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Look up your ward boundary from a directory of Canadian municipal boundaries.
          Select a province, municipality, and ward — then click Load.
        </p>

        <div className="flex flex-col gap-3">

          {/* Province */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Province</label>
            <div className="relative">
              <select
                value={province}
                onChange={(e) => handleProvinceChange(e.target.value)}
                disabled={loadingBoundarySets}
                className="w-full h-10 px-3 pr-9 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">Select province</option>
                {PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                {loadingBoundarySets
                  ? <InlineSpinner />
                  : <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                }
              </div>
            </div>
          </div>

          {/* Municipality */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Municipality</label>
            <div className="relative">
              <select
                value={boundarySetSlug}
                onChange={(e) => handleBoundarySetChange(e.target.value)}
                disabled={!province || loadingBoundarySets || loadingWards || boundarySets.length === 0}
                className="w-full h-10 px-3 pr-9 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">
                  {!province
                    ? "Select province first"
                    : boundarySets.length === 0 && !loadingBoundarySets
                      ? "No results for this province"
                      : "Select municipality"}
                </option>
                {boundarySets.map((bs) => (
                  <option key={bs.slug} value={bs.slug}>{bs.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                {loadingWards
                  ? <InlineSpinner />
                  : <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                }
              </div>
            </div>
          </div>

          {/* Ward — custom multi-select with checkboxes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Ward</label>
            <div className="relative" ref={wardDropdownRef}>
              <button
                type="button"
                onClick={() => setWardDropdownOpen((v) => !v)}
                disabled={!boundarySetSlug || loadingWards || wards.length === 0}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white flex items-center justify-between gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <span className={selectedWardSlugs.length === 0 ? "text-slate-400" : "text-slate-800"}>
                  {!boundarySetSlug
                    ? "Select municipality first"
                    : wards.length === 0 && !loadingWards
                      ? "No wards found"
                      : wardButtonLabel}
                </span>
                <svg
                  className={["h-4 w-4 text-slate-400 flex-shrink-0 transition-transform", wardDropdownOpen ? "rotate-180" : ""].join(" ")}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {wardDropdownOpen && wards.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-56 overflow-y-auto">
                  {wards.map((w) => {
                    const checked = selectedWardSlugs.includes(w.slug);
                    return (
                      <label
                        key={w.slug}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedWardSlugs((prev) =>
                              e.target.checked
                                ? [...prev, w.slug]
                                : prev.filter((s) => s !== w.slug)
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">{w.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Load boundary button */}
          <div>
            <button
              type="button"
              onClick={handleLoadBoundary}
              disabled={selectedWardSlugs.length === 0 || loadingBoundary}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadingBoundary && <InlineSpinner className="text-white" />}
              {loadingBoundary ? "Loading…" : "Load boundary"}
            </button>
          </div>

          {/* Represent error */}
          {representError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {representError}
            </p>
          )}

          <p className="text-xs text-slate-400 leading-relaxed">
            Powered by Represent / Open North. Coverage varies by municipality.
            Use file upload below if your municipality is not listed.
          </p>

        </div>
      </div>

      {/* ── Divider ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">or draw / upload manually</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* ── 2. Toolbar ── */}
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

      {/* ── 3. Drawing instruction banner ── */}
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

      {/* ── 4. Map ── */}
      <div
        className="relative rounded-2xl overflow-hidden border border-slate-200"
        style={{ height: "calc(100dvh - 320px)", minHeight: "400px" }}
      >
        <div ref={mapContainer} className="w-full h-full" />
      </div>

      {/* ── 5. File type helper ── */}
      <p className="text-xs text-slate-400">
        Accepted file types: .geojson (Polygon or MultiPolygon), .kml, .kmz
      </p>

    </div>
  );
}

// ── Inline spinner ────────────────────────────────────────────────────────────

function InlineSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={["animate-spin h-4 w-4", className ?? "text-slate-400"].join(" ")}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
