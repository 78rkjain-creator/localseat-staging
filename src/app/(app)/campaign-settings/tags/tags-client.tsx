"use client";

import { useState, useTransition } from "react";
import { createTag, updateTag, deleteTag } from "./actions";
import { TAG_PRESET_COLORS } from "@/components/ui/tag-picker";

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  personCount: number;
}

function ColorSwatch({ color, selected, onClick }: { color: string | null; selected: boolean; onClick: () => void }) {
  if (color === null) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`h-5 w-5 rounded-full border-2 border-slate-300 bg-white transition-transform ${
          selected ? "ring-2 ring-offset-1 ring-slate-400 scale-110" : "hover:scale-110"
        }`}
        aria-label="No color"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-5 w-5 rounded-full transition-transform ${
        selected ? "ring-2 ring-offset-1 ring-slate-500 scale-110" : "hover:scale-110"
      }`}
      style={{ backgroundColor: color }}
      aria-label={color}
    />
  );
}

function TagChipPreview({ name, color }: { name: string; color: string | null }) {
  const style = color
    ? { backgroundColor: color + "18", color, borderColor: color + "40" }
    : { backgroundColor: "#f1f5f9", color: "#475569", borderColor: "#e2e8f0" };
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
      style={style}
    >
      {name || "Preview"}
    </span>
  );
}

export function TagsClient({ initialTags, tagCap }: { initialTags: TagRow[]; tagCap: number }) {
  const [tags, setTags] = useState<TagRow[]>(initialTags);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // New tag form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string | null>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);

  function startEdit(tag: TagRow) {
    setEditId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setError(null);
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const result = await createTag(name, newColor);
      if (result.error) {
        setError(result.error);
      } else if (result.tag) {
        setTags((prev) => [...prev, { ...result.tag!, personCount: 0 }]);
        setNewName("");
        setNewColor(null);
        setShowAddForm(false);
      }
    });
  }

  function handleUpdate(tagId: string) {
    const name = editName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const result = await updateTag(tagId, name, editColor);
      if (result.error) {
        setError(result.error);
      } else {
        setTags((prev) =>
          prev.map((t) => (t.id === tagId ? { ...t, name, color: editColor } : t))
        );
        setEditId(null);
      }
    });
  }

  function handleDelete(tagId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteTag(tagId);
      if (result.error) {
        setError(result.error);
      } else {
        setTags((prev) => prev.filter((t) => t.id !== tagId));
      }
    });
  }

  const atCap = tags.length >= tagCap;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {tags.length} of {tagCap} tags used
          </p>
        </div>
        {!atCap && (
          <button
            type="button"
            onClick={() => { setShowAddForm(true); setError(null); }}
            disabled={isPending || showAddForm}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add tag
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">New tag</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              placeholder="Tag name"
              maxLength={50}
              autoFocus
              disabled={isPending}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
            />
            {newName.trim() && (
              <TagChipPreview name={newName.trim()} color={newColor} />
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Color (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {TAG_PRESET_COLORS.map((c) => (
                <ColorSwatch key={c} color={c} selected={newColor === c} onClick={() => setNewColor(newColor === c ? null : c)} />
              ))}
              <ColorSwatch color={null} selected={newColor === null} onClick={() => setNewColor(null)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending || !newName.trim()}
              className="h-7 px-3 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewName(""); setNewColor(null); setError(null); }}
              className="h-7 px-3 rounded-xl border border-slate-200 text-slate-600 text-xs hover:bg-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tag list */}
      {tags.length === 0 && !showAddForm ? (
        <p className="text-sm text-slate-400 py-4 text-center">No tags yet. Add your first one above.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {tags.map((tag) => (
            <li key={tag.id} className="px-4 py-3">
              {editId === tag.id ? (
                <div className="space-y-2.5">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleUpdate(tag.id); } else if (e.key === "Escape") cancelEdit(); }}
                      maxLength={50}
                      autoFocus
                      disabled={isPending}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
                    />
                    {editName.trim() && (
                      <TagChipPreview name={editName.trim()} color={editColor} />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TAG_PRESET_COLORS.map((c) => (
                      <ColorSwatch key={c} color={c} selected={editColor === c} onClick={() => setEditColor(editColor === c ? null : c)} />
                    ))}
                    <ColorSwatch color={null} selected={editColor === null} onClick={() => setEditColor(null)} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdate(tag.id)}
                      disabled={isPending || !editName.trim()}
                      className="h-7 px-3 rounded-xl bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
                    >
                      {isPending ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="h-7 px-3 rounded-xl border border-slate-200 text-slate-600 text-xs hover:bg-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color ?? "#94a3b8" }}
                    />
                    <span className="text-sm font-medium text-slate-800 truncate">{tag.name}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {tag.personCount} {tag.personCount === 1 ? "person" : "people"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(tag)}
                      disabled={isPending}
                      className="h-7 px-2.5 rounded-lg text-xs text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tag.id)}
                      disabled={isPending || tag.personCount > 0}
                      title={tag.personCount > 0 ? `Applied to ${tag.personCount} people — remove from all to delete` : "Delete tag"}
                      className="h-7 px-2.5 rounded-lg text-xs text-red-600 border border-red-100 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {atCap && (
        <p className="text-xs text-slate-400 text-center">
          Tag limit reached ({tagCap}). Remove unused tags to add new ones.
        </p>
      )}
    </div>
  );
}
