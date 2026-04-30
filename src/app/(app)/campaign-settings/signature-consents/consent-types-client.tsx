"use client";

import { useState, useTransition } from "react";
import { addConsentType, deleteConsentType, renameConsentType } from "./actions";

interface ConsentTypeRow {
  id: string;
  label: string;
  sortOrder: number;
  usageCount: number;
}

interface Props {
  initialTypes: ConsentTypeRow[];
  cap: number;
}

export function ConsentTypesClient({ initialTypes, cap }: Props) {
  const [types, setTypes] = useState<ConsentTypeRow[]>(initialTypes);
  const [newLabel, setNewLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const atCap = types.length >= cap;

  function handleAdd() {
    setAddError(null);
    startTransition(async () => {
      const result = await addConsentType(newLabel);
      if (result.error) {
        setAddError(result.error);
      } else {
        setNewLabel("");
        // Optimistic add — server will revalidate
        setTypes((prev) => [
          ...prev,
          { id: `temp-${Date.now()}`, label: newLabel.trim(), sortOrder: prev.length, usageCount: 0 },
        ]);
      }
    });
  }

  function startEdit(type: ConsentTypeRow) {
    setEditingId(type.id);
    setEditLabel(type.label);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  function handleRename(id: string) {
    setEditError(null);
    startTransition(async () => {
      const result = await renameConsentType(id, editLabel);
      if (result.error) {
        setEditError(result.error);
      } else {
        setTypes((prev) =>
          prev.map((t) => (t.id === id ? { ...t, label: editLabel.trim() } : t))
        );
        setEditingId(null);
      }
    });
  }

  function handleDelete(id: string) {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteConsentType(id);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        setTypes((prev) => prev.filter((t) => t.id !== id));
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Existing types */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {types.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-slate-400">No consent types yet. Add one below.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {types.map((type) => (
              <li key={type.id} className="px-5 py-3 flex items-center gap-3">
                {editingId === type.id ? (
                  <>
                    <input
                      className="flex-1 h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(type.id); if (e.key === "Escape") cancelEdit(); }}
                      autoFocus
                      maxLength={60}
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(type.id)}
                      disabled={isPending}
                      className="h-9 px-3 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={isPending}
                      className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-800 font-medium">{type.label}</span>
                    {type.usageCount > 0 && (
                      <span className="text-xs text-slate-400">{type.usageCount} use{type.usageCount !== 1 ? "s" : ""}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(type)}
                      className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Rename
                    </button>
                    {type.usageCount === 0 && (
                      <button
                        type="button"
                        onClick={() => handleDelete(type.id)}
                        disabled={isPending}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {editError && <p className="text-sm text-red-600">{editError}</p>}
      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      {/* Add new */}
      {!atCap && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New consent type label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            maxLength={60}
            className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending || !newLabel.trim()}
            className="h-10 px-4 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>
      )}
      {atCap && (
        <p className="text-sm text-slate-400">Maximum of {cap} consent types reached.</p>
      )}
      {addError && <p className="text-sm text-red-600">{addError}</p>}
    </div>
  );
}
