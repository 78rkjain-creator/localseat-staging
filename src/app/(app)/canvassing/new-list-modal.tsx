"use client";

import { useRef, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCanvassList } from "./actions";
import type { DynamicFilters } from "@/lib/canvassing";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
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

export function NewListModal({ open, onClose, tags = [] }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Dynamic list state
  const [isDynamic, setIsDynamic] = useState(false);
  const [supportLevels, setSupportLevels] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [canvassStatus, setCanvassStatus] = useState<DynamicFilters["canvassStatus"]>("");
  const [wardStatuses, setWardStatuses] = useState<string[]>([]);

  function toggleItem<T extends string>(
    arr: T[],
    setArr: (v: T[]) => void,
    value: T
  ) {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    if (isDynamic) {
      const filters: DynamicFilters = {
        ...(supportLevels.length ? { supportLevels } : {}),
        ...(tagIds.length ? { tagIds } : {}),
        ...(canvassStatus ? { canvassStatus } : {}),
        ...(wardStatuses.length ? { wardStatuses } : {}),
      };
      formData.set("isDynamic", "true");
      formData.set("dynamicFilters", JSON.stringify(filters));
    } else {
      formData.set("isDynamic", "false");
    }

    startTransition(async () => {
      const result = await createCanvassList(formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleClose() {
    formRef.current?.reset();
    setError(null);
    setIsDynamic(false);
    setSupportLevels([]);
    setTagIds([]);
    setCanvassStatus("");
    setWardStatuses([]);
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

        {/* Dynamic list toggle */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Dynamic list</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Auto-updates based on filters — new matches are added, non-matches removed.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isDynamic}
              onClick={() => setIsDynamic((v) => !v)}
              className={[
                "relative flex-shrink-0 h-6 w-11 rounded-full transition-colors focus:outline-none",
                isDynamic ? "bg-brand-500" : "bg-slate-300",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  isDynamic ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </button>
          </div>

          {isDynamic && (
            <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col gap-4">
              {/* Canvass status */}
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Canvass status
                </p>
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
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Support level
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUPPORT_OPTIONS.map((opt) => {
                    const checked = supportLevels.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleItem(supportLevels, setSupportLevels, opt.value)}
                        className={[
                          "h-7 px-3 rounded-lg text-xs font-medium border transition-colors",
                          checked
                            ? "bg-brand-500 text-white border-brand-500"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ward status */}
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Ward status
                </p>
                <div className="flex flex-wrap gap-2">
                  {WARD_OPTIONS.map((opt) => {
                    const checked = wardStatuses.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleItem(wardStatuses, setWardStatuses, opt.value)}
                        className={[
                          "h-7 px-3 rounded-lg text-xs font-medium border transition-colors",
                          checked
                            ? "bg-brand-500 text-white border-brand-500"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const checked = tagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleItem(tagIds, setTagIds, tag.id)}
                          className={[
                            "h-7 px-3 rounded-lg text-xs font-medium border transition-colors",
                            checked
                              ? "bg-brand-500 text-white border-brand-500"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300",
                          ].join(" ")}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={handleClose} disabled={isPending}>
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
