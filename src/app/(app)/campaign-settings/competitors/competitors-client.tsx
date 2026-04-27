"use client";

import { useState } from "react";
import { addCompetitorAction, updateCompetitorAction, deleteCompetitorAction } from "./actions";

interface Competitor {
  id: string;
  name: string;
  sortOrder: number;
}

interface Props {
  competitors: Competitor[];
}

export function CompetitorsClient({ competitors: initialCompetitors }: Props) {
  const [localCompetitors, setLocalCompetitors] = useState<Competitor[]>(initialCompetitors);
  const [addName, setAddName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  async function handleAdd() {
    const name = addName.trim();
    if (!name) return;
    setIsAdding(true);
    setError(null);
    const result = await addCompetitorAction(name);
    setIsAdding(false);
    if ("error" in result) {
      setError(result.error ?? null);
      return;
    }
    setLocalCompetitors((prev) => [
      ...prev,
      { id: result.competitor.id, name: result.competitor.name, sortOrder: result.competitor.sortOrder },
    ]);
    setAddName("");
  }

  async function handleUpdate(id: string) {
    const name = editName.trim();
    if (!name) return;
    const result = await updateCompetitorAction(id, name);
    if ("error" in result) {
      setError(result.error ?? null);
      return;
    }
    setLocalCompetitors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: result.competitor.name } : c))
    );
    setEditingId(null);
    setEditName("");
  }

  async function handleDelete(id: string) {
    const result = await deleteCompetitorAction(id);
    if ("error" in result) {
      setError(result.error ?? null);
      return;
    }
    setLocalCompetitors((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Add form */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Candidate name"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          className="h-11 flex-1 rounded-2xl border border-slate-200 px-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isAdding || !addName.trim()}
          className="h-11 px-5 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {isAdding ? "Adding…" : "Add"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* List */}
      {localCompetitors.length === 0 ? (
        <p className="text-sm text-slate-400 py-4">
          No competitors added yet. Add the names of other candidates in your race.
        </p>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
          {localCompetitors.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 last:border-0"
            >
              {editingId === item.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate(item.id);
                      if (e.key === "Escape") { setEditingId(null); setEditName(""); }
                    }}
                    autoFocus
                    className="flex-1 h-8 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => handleUpdate(item.id)}
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setEditName(""); }}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-slate-900">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => { setEditingId(item.id); setEditName(item.name); setError(null); }}
                    className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
