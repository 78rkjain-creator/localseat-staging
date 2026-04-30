"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { getPersonsNeedingGeocode, bulkGeocodePersonsBatch } from "./geocode-actions";

const BATCH_SIZE = 20;

interface Props {
  initialCount: number;
}

export function BulkGeocodeButton({ initialCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (count === 0) return null;

  function handleOpen() {
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    if (running) return;
    setOpen(false);
    setProgress(null);
    setError(null);
  }

  async function handleRun() {
    setError(null);
    setRunning(true);

    const result = await getPersonsNeedingGeocode();
    if (result.error || !result.ids?.length) {
      setError(result.error ?? "No records found to geocode.");
      setRunning(false);
      return;
    }

    const ids = result.ids;
    setProgress({ done: 0, total: ids.length });

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      await bulkGeocodePersonsBatch(batch);
      setProgress({ done: Math.min(i + BATCH_SIZE, ids.length), total: ids.length });
    }

    setCount(0);
    setRunning(false);
    setOpen(false);
    setProgress(null);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
      >
        <svg
          className="h-4 w-4 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Geocode {count} records
      </button>

      <Modal open={open} onClose={handleClose} title="Geocode records">
        {progress ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <p className="text-sm text-slate-600">
              Processing {progress.done} of {progress.total} records…
            </p>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-brand-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((progress.done / progress.total) * 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-slate-400">Do not close this window.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              This will geocode <strong>{count}</strong> record
              {count !== 1 ? "s" : ""} that are missing location data. Large
              sets may take several minutes.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 h-11 rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRun}
                disabled={running}
                className="flex-1 h-11 rounded-2xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                Geocode now
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
