"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  updateListName,
  updateListFilters,
  searchPeopleForList,
  addPersonToList,
} from "../actions";
import type { DynamicFilters } from "@/lib/canvassing";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  listId: string;
  currentName: string;
  isDynamic: boolean;
  currentFilters?: DynamicFilters | null;
  tags?: Tag[];
}

const SUPPORT_OPTIONS = [
  { value: "strong_yes", label: "Strong Yes" },
  { value: "soft_yes",   label: "Soft Yes" },
  { value: "undecided",  label: "Undecided" },
  { value: "soft_no",    label: "Soft No" },
  { value: "strong_no",  label: "Strong No" },
];

const WARD_OPTIONS = [
  { value: "inside",           label: "Inside ward" },
  { value: "not_checked",      label: "Not yet checked" },
  { value: "outside_accepted", label: "Outside (accepted)" },
];

type SearchResult = { id: string; firstName: string; lastName: string; addressLine: string };

export function EditListModal({ open, onClose, listId, currentName, isDynamic, currentFilters, tags = [] }: Props) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Dynamic filter state
  const filters = currentFilters ?? {};
  const [supportLevels, setSupportLevels] = useState<string[]>(filters.supportLevels ?? []);
  const [tagIds, setTagIds] = useState<string[]>(filters.tagIds ?? []);
  const [canvassStatus, setCanvassStatus] = useState<DynamicFilters["canvassStatus"]>(filters.canvassStatus ?? "");
  const [wardStatuses, setWardStatuses] = useState<string[]>(filters.wardStatuses ?? []);

  // Static list person-search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, startSearch] = useTransition();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when re-opened
  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
      setSupportLevels(currentFilters?.supportLevels ?? []);
      setTagIds(currentFilters?.tagIds ?? []);
      setCanvassStatus(currentFilters?.canvassStatus ?? "");
      setWardStatuses(currentFilters?.wardStatuses ?? []);
      setSearchQuery("");
      setSearchResults([]);
      setAddedIds(new Set());
    }
  }, [open, currentName, currentFilters]);

  const runSearch = useCallback(
    (q: string) => {
      if (q.trim().length < 2) { setSearchResults([]); return; }
      startSearch(async () => {
        const results = await searchPeopleForList(listId, q);
        setSearchResults(results);
      });
    },
    [listId]
  );

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 300);
  }

  function handleAddPerson(person: SearchResult) {
    startTransition(async () => {
      const result = await addPersonToList(listId, person.id);
      if (!result?.error) {
        setAddedIds((prev) => new Set([...prev, person.id]));
        setSearchResults((prev) => prev.filter((p) => p.id !== person.id));
      }
    });
  }

  function toggleItem<T extends string>(arr: T[], setArr: (v: T[]) => void, value: T) {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const nameResult = await updateListName(listId, name);
      if (nameResult?.error) { setError(nameResult.error); return; }

      if (isDynamic) {
        const newFilters: DynamicFilters = {
          ...(supportLevels.length ? { supportLevels } : {}),
          ...(tagIds.length ? { tagIds } : {}),
          ...(canvassStatus ? { canvassStatus } : {}),
          ...(wardStatuses.length ? { wardStatuses } : {}),
        };
        const filterResult = await updateListFilters(listId, newFilters);
        if (filterResult?.error) { setError(filterResult.error); return; }
      }

      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit walk list">
      <div className="flex flex-col gap-4">
        <Input
          label="List name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          autoFocus
        />

        {isDynamic && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter criteria</p>

            {/* Canvass status */}
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Canvass status</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "", label: "Any" },
                  { value: "not_yet_canvassed", label: "Not yet canvassed" },
                  { value: "canvassed", label: "Canvassed" },
                  { value: "not_home", label: "Not home" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCanvassStatus(opt.value as DynamicFilters["canvassStatus"])}
                    className={[
                      "h-7 px-3 rounded-lg text-xs font-medium border transition-colors",
                      canvassStatus === opt.value
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Support levels */}
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Support level</p>
              <div className="flex flex-wrap gap-2">
                {SUPPORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleItem(supportLevels, setSupportLevels, opt.value)}
                    className={[
                      "h-7 px-3 rounded-lg text-xs font-medium border transition-colors",
                      supportLevels.includes(opt.value)
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ward status */}
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Ward status</p>
              <div className="flex flex-wrap gap-2">
                {WARD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleItem(wardStatuses, setWardStatuses, opt.value)}
                    className={[
                      "h-7 px-3 rounded-lg text-xs font-medium border transition-colors",
                      wardStatuses.includes(opt.value)
                        ? "bg-brand-500 text-white border-brand-500"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleItem(tagIds, setTagIds, tag.id)}
                      className={[
                        "h-7 px-3 rounded-lg text-xs font-medium border transition-colors",
                        tagIds.includes(tag.id)
                          ? "bg-brand-500 text-white border-brand-500"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                      ].join(" ")}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!isDynamic && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">Add people</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or street…"
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {addedIds.size > 0 && (
              <p className="text-xs text-emerald-600">{addedIds.size} person{addedIds.size !== 1 ? "s" : ""} added</p>
            )}

            {searchResults.length > 0 && (
              <ul className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {searchResults.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-slate-400 truncate">{p.addressLine}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddPerson(p)}
                      disabled={isPending}
                      className="flex-shrink-0 h-7 px-3 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 transition-colors disabled:opacity-50"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
              <p className="text-xs text-slate-400">No results for &ldquo;{searchQuery}&rdquo;</p>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" fullWidth onClick={handleSave} loading={isPending}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
