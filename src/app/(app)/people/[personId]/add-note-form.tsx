"use client";

import { useRef, useState, useTransition } from "react";
import { addNote } from "./actions";
import { Button } from "@/components/ui/button";

interface AddNoteFormProps {
  personId: string;
  campaignId: string;
}

export function AddNoteForm({ personId, campaignId }: AddNoteFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await addNote(personId, campaignId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        name="body"
        placeholder="Add a note…"
        rows={3}
        required
        maxLength={2000}
        className={[
          "w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900",
          "placeholder:text-slate-400 resize-none",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent",
          error
            ? "border-red-300"
            : "border-slate-200 hover:border-slate-300",
        ].join(" ")}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={isPending}>
          Save note
        </Button>
      </div>
    </form>
  );
}
