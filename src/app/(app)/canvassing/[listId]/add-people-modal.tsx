"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { previewFilter, addFilteredPeople } from "./actions";
import type { FilterParams } from "./actions";
import type { SupportLevel } from "@/types";
import { SUPPORT_LEVEL_LABELS } from "@/types";

interface Tag {
  id: string;
  name: string;
}

interface AddPeopleModalProps {
  open: boolean;
  onClose: () => void;
  listId: string;
  tags: Tag[];
}

const EMPTY_FILTERS: FilterParams = {
  streetName: "",
  postalCode: "",
  supportLevel: "",
  tagId: "",
  notYetCanvassed: false,
};

export function AddPeopleModal({
  open,
  onClose,
  listId,
  tags,
}: AddPeopleModalProps) {
  const [filters, setFilters] = useState<FilterParams>(EMPTY_FILTERS);
  const [preview, setPreview] = useState<{
    count: number;
    sample: string[];
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<number | null>(null);

  const [isPreviewing, startPreview] = useTransition();
  const [isSubmitting, startSubmit] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce preview as filters change
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewError(null);
      startPreview(async () => {
        const result = await previewFilter(listId, filters);
        if (result.error) {
          setPreviewError(result.error);
          setPreview(null);
        } else {
          setPreview({ count: result.count ?? 0, sample: result.sample ?? [] });
        }
      });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, open]);

  function handleClose() {
    setFilters(EMPTY_FILTERS);
    setPreview(null);
    setPreviewError(null);
    setSubmitError(null);
    setSuccess(null);
    onClose();
  }

  function handleConfirm() {
    setSubmitError(null);
    startSubmit(async () => {
      const result = await addFilteredPeople(listId, filters);
      if (result.error) {
        setSubmitError(result.error);
      } else {
        setSuccess(result.added ?? 0);
      }
    });
  }

  const canConfirm = preview !== null && preview.count > 0 && !isSubmitting;

  return (
    <Modal open={open} onClose={handleClose} title="Add people to list" maxWidth="max-w-lg">
      {success !== null ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-900">
            {success} {success === 1 ? "person" : "people"} added
          </p>
          <Button onClick={handleClose}>Done</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-slate-500">
            Set filters to select matching people. Leave all filters blank to add everyone in the campaign not already on this list.
          </p>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Street name"
              value={filters.streetName ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, streetName: e.target.value }))
              }
              placeholder="e.g. Elm Street"
            />
            <Input
              label="Postal code"
              value={filters.postalCode ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, postalCode: e.target.value }))
              }
              placeholder="e.g. K1A 0B1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Support level */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Support level
              </label>
              <select
                value={filters.supportLevel ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    supportLevel: e.target.value as SupportLevel | "",
                  }))
                }
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors appearance-none"
              >
                <option value="">Any</option>
                {(Object.keys(SUPPORT_LEVEL_LABELS) as SupportLevel[]).map(
                  (level) => (
                    <option key={level} value={level}>
                      {SUPPORT_LEVEL_LABELS[level]}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Tag */}
            {tags.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Tag</label>
                <select
                  value={filters.tagId ?? ""}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, tagId: e.target.value }))
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors appearance-none"
                >
                  <option value="">Any tag</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Not yet canvassed toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.notYetCanvassed ?? false}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  notYetCanvassed: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">
              Not yet canvassed (no prior response recorded)
            </span>
          </label>

          {/* Preview result */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 min-h-[72px] flex flex-col justify-center">
            {isPreviewing ? (
              <p className="text-sm text-slate-400">Counting…</p>
            ) : previewError ? (
              <p className="text-sm text-red-500">{previewError}</p>
            ) : preview === null ? (
              <p className="text-sm text-slate-400">Adjust filters to see a count.</p>
            ) : preview.count === 0 ? (
              <p className="text-sm text-slate-500">
                No matching people found outside this list.
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-900">
                  {preview.count} {preview.count === 1 ? "person" : "people"} match
                </p>
                {preview.sample.length > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    e.g.{" "}
                    {preview.sample.join(", ")}
                    {preview.count > preview.sample.length ? "…" : ""}
                  </p>
                )}
              </>
            )}
          </div>

          {submitError && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              fullWidth
              onClick={handleConfirm}
              disabled={!canConfirm}
              loading={isSubmitting}
            >
              {preview && preview.count > 0
                ? `Add ${preview.count} ${preview.count === 1 ? "person" : "people"}`
                : "Add people"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
