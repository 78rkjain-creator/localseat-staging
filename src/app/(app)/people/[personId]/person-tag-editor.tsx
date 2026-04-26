"use client";

import { useState, useTransition } from "react";
import { addTagToPerson, removeTagFromPerson } from "./actions";
import { TagPicker, type TagData } from "@/components/ui/tag-picker";

function TagChip({ tag, onRemove }: { tag: TagData; onRemove?: () => void }) {
  const style = tag.color
    ? { backgroundColor: tag.color + "18", color: tag.color, borderColor: tag.color + "40" }
    : { backgroundColor: "#f1f5f9", color: "#475569", borderColor: "#e2e8f0" };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full text-xs font-medium border px-2 py-0.5"
      style={style}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full hover:bg-black/10 p-0.5 transition-colors flex-shrink-0"
          aria-label={`Remove ${tag.name}`}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}

export function PersonTagEditor({
  personId,
  initialTags,
  campaignTags,
  canEdit,
}: {
  personId: string;
  initialTags: TagData[];
  campaignTags: TagData[];
  canEdit: boolean;
}) {
  const [tags, setTags] = useState<TagData[]>(initialTags);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove(tagId: string) {
    const removed = tags.find((t) => t.id === tagId);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    setError(null);
    startTransition(async () => {
      const result = await removeTagFromPerson(personId, tagId);
      if (result.error) {
        setError(result.error);
        if (removed) setTags((prev) => [...prev, removed]);
      }
    });
  }

  function handleSelect(tag: TagData) {
    setTags((prev) => [...prev, tag]);
    setError(null);
    startTransition(async () => {
      const result = await addTagToPerson(personId, tag.id);
      if (result.error) {
        setError(result.error);
        setTags((prev) => prev.filter((t) => t.id !== tag.id));
      }
    });
  }

  if (!canEdit) {
    if (tags.length === 0) return <p className="text-sm text-slate-400">No tags.</p>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => <TagChip key={tag.id} tag={tag} />)}
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              onRemove={isPending ? undefined : () => handleRemove(tag.id)}
            />
          ))}
        </div>
      )}

      <TagPicker
        campaignTags={campaignTags}
        appliedTagIds={new Set(tags.map((t) => t.id))}
        onSelect={handleSelect}
        disabled={isPending}
      />
    </div>
  );
}
