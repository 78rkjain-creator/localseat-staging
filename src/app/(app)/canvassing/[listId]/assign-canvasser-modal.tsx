"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { assignCanvasser } from "../actions";

interface AssignCanvasserModalProps {
  open: boolean;
  onClose: () => void;
  listId: string;
  canvassers: { id: string; firstName: string; lastName: string }[];
}

export function AssignCanvasserModal({
  open,
  onClose,
  listId,
  canvassers,
}: AssignCanvasserModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Auto-focus search when modal opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = canvassers.filter((c) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      c.firstName.toLowerCase().includes(term) ||
      c.lastName.toLowerCase().includes(term)
    );
  });

  const selectedCanvasser = canvassers.find((c) => c.id === selectedId);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) return;
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await assignCanvasser(listId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        handleClose();
      }
    });
  }

  function handleClose() {
    setSearch("");
    setSelectedId("");
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Assign canvasser">
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Hidden input carries selected ID for FormData */}
        <input type="hidden" name="canvasserId" value={selectedId} />

        {/* Searchable canvasser picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Canvasser</label>

          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
          />

          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400">No matches</p>
            ) : (
              filtered.map((c) => {
                const isSelected = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={[
                      "w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors",
                      isSelected
                        ? "bg-brand-50 text-brand-700 font-medium"
                        : "text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span>
                      {c.firstName} {c.lastName}
                    </span>
                    {isSelected && (
                      <svg
                        className="h-4 w-4 text-brand-600 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {selectedCanvasser && (
            <p className="text-xs text-slate-500">
              Selected:{" "}
              <span className="font-medium text-slate-700">
                {selectedCanvasser.firstName} {selectedCanvasser.lastName}
              </span>
            </p>
          )}
        </div>

        {/* Optional notes */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="assign-notes" className="text-sm font-medium text-slate-700">
            Notes{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="assign-notes"
            name="notes"
            placeholder="Any instructions for this canvasser…"
            rows={2}
            maxLength={500}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 resize-none hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            fullWidth
            loading={isPending}
            disabled={!selectedId || isPending}
          >
            Assign
          </Button>
        </div>
      </form>
    </Modal>
  );
}
