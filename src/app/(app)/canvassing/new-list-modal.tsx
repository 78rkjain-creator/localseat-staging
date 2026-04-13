"use client";

import { useRef, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCanvassList } from "./actions";

interface NewListModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewListModal({ open, onClose }: NewListModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createCanvassList(formData);
      // createCanvassList redirects on success, so result only arrives on error
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  function handleClose() {
    formRef.current?.reset();
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="New walk list">
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="List name"
          name="name"
          placeholder="e.g. Elm Street Block — Round 1"
          required
          maxLength={120}
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">
            Description{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            name="description"
            placeholder="Any notes about this list, area, or canvassing approach…"
            rows={3}
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
            Create list
          </Button>
        </div>
      </form>
    </Modal>
  );
}
