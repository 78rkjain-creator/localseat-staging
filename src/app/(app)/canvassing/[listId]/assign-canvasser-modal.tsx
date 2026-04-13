"use client";

import { useRef, useState, useTransition } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await assignCanvasser(listId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        onClose();
      }
    });
  }

  function handleClose() {
    formRef.current?.reset();
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Assign canvasser">
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Canvasser select */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="canvasserId"
            className="text-sm font-medium text-slate-700"
          >
            Canvasser
          </label>
          <select
            id="canvasserId"
            name="canvasserId"
            required
            defaultValue=""
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors appearance-none"
          >
            <option value="" disabled>
              Select a canvasser…
            </option>
            {canvassers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </div>

        {/* Optional notes */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="assign-notes"
            className="text-sm font-medium text-slate-700"
          >
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
          <Button type="submit" fullWidth loading={isPending}>
            Assign
          </Button>
        </div>
      </form>
    </Modal>
  );
}
