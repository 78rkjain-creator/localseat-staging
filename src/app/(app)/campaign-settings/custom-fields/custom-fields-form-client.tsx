"use client";

import { useState, useTransition } from "react";
import { saveCustomFields } from "./actions";
import type { CustomField } from "./actions";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface Props {
  initialFields: CustomField[];
}

export function CustomFieldsFormClient({ initialFields }: Props) {
  const [fields, setFields] = useState<CustomField[]>(
    initialFields.length > 0 ? initialFields : []
  );
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function addField() {
    if (fields.length >= 5) return;
    setFields((prev) => [...prev, { id: generateId(), label: "" }]);
    setSaveMsg(null);
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setSaveMsg(null);
  }

  function updateLabel(id: string, label: string) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)));
    setSaveMsg(null);
  }

  function handleSave() {
    setSaveMsg(null);
    startTransition(async () => {
      const result = await saveCustomFields(fields);
      if (result.error) {
        setSaveMsg({ type: "error", text: result.error });
      } else {
        setSaveMsg({ type: "success", text: "Custom fields saved." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {fields.length === 0 ? (
        <p className="text-sm text-slate-400">No custom fields defined yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {fields.map((field, idx) => (
            <li key={field.id} className="flex items-center gap-3">
              <span className="text-sm text-slate-400 w-5 text-right flex-shrink-0">
                {idx + 1}.
              </span>
              <input
                type="text"
                value={field.label}
                onChange={(e) => updateLabel(field.id, e.target.value)}
                placeholder="Field label (e.g. Preferred Language)"
                maxLength={60}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                onClick={() => removeField(field.id)}
                disabled={isPending}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                title="Remove field"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ol>
      )}

      {fields.length < 5 && (
        <button
          onClick={addField}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors self-start"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add field
        </button>
      )}

      {fields.length >= 5 && (
        <p className="text-xs text-slate-400">Maximum 5 custom fields.</p>
      )}

      {saveMsg && (
        <p
          className={[
            "text-xs rounded-xl px-3 py-2 border",
            saveMsg.type === "success"
              ? "text-emerald-700 bg-emerald-50 border-emerald-100"
              : "text-red-600 bg-red-50 border-red-100",
          ].join(" ")}
        >
          {saveMsg.text}
        </p>
      )}

      <div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Saving…" : "Save fields"}
        </button>
      </div>
    </div>
  );
}
