"use client";

import type { Polygon } from "geojson";

interface Props {
  wardBoundary: Polygon | null;
  wardBoundarySetAt: string | null; // ISO string — Date serialised from server
}

export function WardMapClient({ wardBoundary, wardBoundarySetAt }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center p-12 text-center">
      <div>
        <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
          <svg
            className="h-6 w-6 text-brand-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
        </div>
        {wardBoundary ? (
          <>
            <p className="text-sm font-semibold text-slate-900">
              Ward boundary set
            </p>
            {wardBoundarySetAt && (
              <p className="text-xs text-slate-500 mt-1">
                Last updated{" "}
                {new Date(wardBoundarySetAt).toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-900">
              No boundary set yet
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Map editor coming in the next step.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
