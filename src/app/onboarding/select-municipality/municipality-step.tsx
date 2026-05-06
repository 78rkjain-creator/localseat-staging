"use client";

import { useActionState, useState, useEffect } from "react";
import { saveMunicipality } from "./actions";
import type { SaveMunicipalityState } from "./actions";
import { MunicipalitySelector } from "@/components/ui/municipality-selector";
import type { MunicipalitySelectorValue } from "@/components/ui/municipality-selector";
import { MunicipalityMap } from "@/components/ui/municipality-map";
import type { Polygon, MultiPolygon } from "geojson";

interface BoundaryIndex {
  [municipalityId: string]: string;
}

interface Props {
  campaignId: string;
  required: boolean;
  nextUrl: string;
  initialMunicipality: MunicipalitySelectorValue | null;
  initialBoundary: Polygon | MultiPolygon | null;
}

const initialState: SaveMunicipalityState = {};

function bboxToPolygon(bbox: [number, number, number, number]): Polygon {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return {
    type: "Polygon",
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  };
}

export function MunicipalityStep({
  campaignId,
  required,
  nextUrl,
  initialMunicipality,
  initialBoundary,
}: Props) {
  const [state, formAction, isPending] = useActionState(saveMunicipality, initialState);
  const [selected, setSelected] = useState<MunicipalitySelectorValue | null>(initialMunicipality);
  const [boundary, setBoundary] = useState<Polygon | MultiPolygon | null>(initialBoundary);
  const [loadingBoundary, setLoadingBoundary] = useState(false);

  // When we have an initial municipality with an id but no boundary (not seeded),
  // attempt to fetch the boundary file on mount.
  useEffect(() => {
    if (initialBoundary || !initialMunicipality?.id) return;
    void fetchBoundary(initialMunicipality.id, initialMunicipality.bbox);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchBoundary(
    id: string,
    bbox?: [number, number, number, number]
  ) {
    setLoadingBoundary(true);
    try {
      const indexRes = await fetch("/data/boundaries/index.json").catch(() => null);
      if (indexRes?.ok) {
        const index: BoundaryIndex = await indexRes.json();
        const path = index[id];
        if (path) {
          const geoRes = await fetch(path);
          if (geoRes.ok) {
            const geo = (await geoRes.json()) as Polygon | MultiPolygon;
            setBoundary(geo);
            return;
          }
        }
      }
      // Fallback: derive rectangle from bbox
      if (bbox) {
        setBoundary(bboxToPolygon(bbox));
      }
    } catch {
      if (bbox) setBoundary(bboxToPolygon(bbox));
    } finally {
      setLoadingBoundary(false);
    }
  }

  async function handleSelect(value: MunicipalitySelectorValue | null) {
    setSelected(value);
    setBoundary(null);

    if (!value) return;

    if (value.id) {
      await fetchBoundary(value.id, value.bbox);
    } else if (value.bbox) {
      // Custom entry with bbox (shouldn't normally happen, but safe)
      setBoundary(bboxToPolygon(value.bbox));
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="nextUrl" value={nextUrl} />
      <input type="hidden" name="municipalityName" value={selected?.name ?? ""} />
      <input type="hidden" name="municipalityId" value={selected?.id ?? ""} />
      <input
        type="hidden"
        name="municipalityBoundary"
        value={boundary ? JSON.stringify(boundary) : ""}
      />

      <MunicipalitySelector
        value={selected}
        onChange={handleSelect}
        placeholder="Search Ontario municipalities…"
      />

      <MunicipalityMap
        boundary={boundary}
        municipalityName={selected?.name ?? null}
        center={selected?.center}
        loading={loadingBoundary}
      />

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending || !selected}
          className="w-full h-11 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : "Confirm municipality"}
        </button>

        {!required && (
          <a
            href={nextUrl}
            className="w-full h-11 flex items-center justify-center text-sm text-slate-500 hover:text-slate-700 transition-colors rounded-xl hover:bg-slate-50"
          >
            Skip for now
          </a>
        )}
      </div>
    </form>
  );
}
