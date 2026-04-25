"use client";

import { useState, useTransition } from "react";
import { saveCustomFieldValues } from "./custom-fields-actions";

export interface CustomField {
  id: string;
  label: string;
}

interface Props {
  personId: string;
  fields: CustomField[];
  values: Record<string, string>;
  readOnly?: boolean;
}

export function CustomFieldsEditor({ personId, fields, values, readOnly }: Props) {
  const [localValues, setLocalValues] = useState<Record<string, string>>(values);
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  if (fields.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No custom fields defined.{" "}
        <a href="/campaign-settings/custom-fields" className="text-slate-600 underline underline-offset-2">
          Add fields in settings.
        </a>
      </p>
    );
  }

  function handleChange(id: string, value: string) {
    setLocalValues((prev) => ({ ...prev, [id]: value }));
    setDirty(true);
    setSaveMsg(null);
  }

  function handleSave() {
    setSaveMsg(null);
    startTransition(async () => {
      const result = await saveCustomFieldValues(personId, localValues);
      if (result.error) {
        setSaveMsg({ type: "error", text: result.error });
      } else {
        setSaveMsg({ type: "success", text: "Saved." });
        setDirty(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <div key={field.id} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">{field.label}</label>
          {readOnly ? (
            <p className="text-sm text-slate-800">{localValues[field.id] || <span className="text-slate-400">—</span>}</p>
          ) : (
            <input
              type="text"
              value={localValues[field.id] ?? ""}
              onChange={(e) => handleChange(field.id, e.target.value)}
              placeholder="—"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          )}
        </div>
      ))}

      {!readOnly && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={isPending || !dirty}
            className="inline-flex items-center h-8 px-3 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          {saveMsg && (
            <span
              className={[
                "text-xs",
                saveMsg.type === "success" ? "text-emerald-600" : "text-red-500",
              ].join(" ")}
            >
              {saveMsg.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
