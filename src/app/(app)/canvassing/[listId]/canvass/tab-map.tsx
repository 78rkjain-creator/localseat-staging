"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { CanvassState } from "./use-canvass-state";

// Mapbox GL JS types (loaded via CDN)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global {
  interface Window {
    mapboxgl?: any;
  }
}

interface TabMapProps {
  state: CanvassState;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export function TabMap({ state }: TabMapProps) {
  const { entries, current, savedSet, gpsPosition, displayEntries } = state;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const gpsMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Load Mapbox GL JS from CDN
  useEffect(() => {
    if (window.mapboxgl) {
      setMapLoaded(true);
      return;
    }
    if (!MAPBOX_TOKEN) {
      setMapError("Mapbox token not configured");
      return;
    }

    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css";
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js";
    script.onload = () => setMapLoaded(true);
    script.onerror = () => setMapError("Failed to load map library");
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount (script stays cached)
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !window.mapboxgl || !mapContainerRef.current) return;
    if (mapRef.current) return; // already initialized

    const mapboxgl = window.mapboxgl;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-79.4, 43.7], // Default: Toronto
      zoom: 13,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapLoaded]);

  // Update markers when entries/savedSet/current change
  const updateMarkers = useCallback(() => {
    if (!mapRef.current || !window.mapboxgl) return;
    const mapboxgl = window.mapboxgl;
    const map = mapRef.current;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    for (const entry of entries) {
      const addr = entry.person.address;
      if (!addr?.lat || !addr?.lng) continue;

      const isCurrent = current?.person.id === entry.person.id;
      const isDone = savedSet.has(entry.person.id);

      // Pin color
      const color = isCurrent ? "#3b82f6" : isDone ? "#22c55e" : "#f97316";

      // Create marker element
      const el = document.createElement("div");
      el.style.width = isCurrent ? "20px" : "14px";
      el.style.height = isCurrent ? "20px" : "14px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = color;
      el.style.border = `2px solid ${isCurrent ? "#1d4ed8" : isDone ? "#15803d" : "#c2410c"}`;
      el.style.boxShadow = isCurrent
        ? "0 0 0 6px rgba(59,130,246,0.25)"
        : "0 1px 3px rgba(0,0,0,0.2)";
      if (isCurrent) {
        el.style.animation = "pulse 2s infinite";
      }

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([addr.lng, addr.lat])
        .addTo(map);

      // Popup
      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(
          `<div style="font-size:12px;line-height:1.4">
            <strong>${entry.person.firstName} ${entry.person.lastName}</strong><br/>
            <span style="color:#64748b">${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}</span><br/>
            <span style="color:${isDone ? '#16a34a' : '#ea580c'};font-weight:600">${isDone ? "Canvassed" : isCurrent ? "Current" : "Remaining"}</span>
          </div>`
        );
      marker.setPopup(popup);

      markersRef.current.push(marker);
      bounds.extend([addr.lng, addr.lat]);
      hasBounds = true;
    }

    // Fit bounds
    if (hasBounds) {
      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 16,
        duration: 800,
      });
    }
  }, [entries, current, savedSet]);

  useEffect(() => {
    if (mapLoaded) updateMarkers();
  }, [mapLoaded, updateMarkers]);

  // Update GPS position marker
  useEffect(() => {
    if (!mapRef.current || !window.mapboxgl || !gpsPosition) return;
    const mapboxgl = window.mapboxgl;

    if (gpsMarkerRef.current) {
      gpsMarkerRef.current.setLngLat([gpsPosition.lng, gpsPosition.lat]);
    } else {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#6366f1";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 0 0 4px rgba(99,102,241,0.3), 0 2px 6px rgba(0,0,0,0.3)";

      gpsMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([gpsPosition.lng, gpsPosition.lat])
        .addTo(mapRef.current);
    }
  }, [gpsPosition, mapLoaded]);

  // Re-center on current person when they change
  useEffect(() => {
    if (!mapRef.current || !current?.person.address?.lat || !current?.person.address?.lng) return;
    mapRef.current.flyTo({
      center: [current.person.address.lng, current.person.address.lat],
      zoom: 16,
      duration: 600,
    });
  }, [current?.person.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mapError) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm text-slate-500 mb-2">{mapError}</p>
          <p className="text-xs text-slate-400">The map requires a Mapbox access token.</p>
        </div>
      </div>
    );
  }

  const currentAddr = current?.person.address;

  return (
    <div className="flex-1 relative">
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 6px rgba(59,130,246,0.25); }
          50% { box-shadow: 0 0 0 12px rgba(59,130,246,0.1); }
        }
      `}</style>

      {/* Map container */}
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Current person overlay */}
      {current && (
        <div className="absolute top-3 left-3 right-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm px-3 py-2">
          <p className="text-sm font-bold text-slate-900 truncate">
            {current.person.firstName} {current.person.lastName}
          </p>
          {currentAddr && (
            <p className="text-xs text-slate-500 truncate">
              {currentAddr.streetNumber} {currentAddr.streetName}
              {currentAddr.unitNumber ? ` #${currentAddr.unitNumber}` : ""}
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm px-3 py-2.5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 border border-green-700" />
            <span className="text-[10px] font-medium text-slate-600">Canvassed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 border border-blue-700" />
            <span className="text-[10px] font-medium text-slate-600">Current</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500 border border-orange-700" />
            <span className="text-[10px] font-medium text-slate-600">Remaining</span>
          </div>
          {gpsPosition && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500 border-2 border-white shadow" />
              <span className="text-[10px] font-medium text-slate-600">Your location</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
