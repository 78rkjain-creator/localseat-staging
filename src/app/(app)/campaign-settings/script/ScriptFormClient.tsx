"use client";

import { useState, useTransition } from "react";
import { saveCanvassScript } from "./actions";

interface Props {
  initialScript: string | null;
}

export function ScriptFormClient({ initialScript }: Props) {
  const [script, setScript] = useState(initialScript ?? "");
  const [isPending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSave() {
    setSaveMsg(null);
    startTransition(async () => {
      const result = await saveCanvassScript(script);
      if (result.error) {
        setSaveMsg({ type: "error", text: result.error });
      } else {
        setSaveMsg({ type: "success", text: "Canvassing script saved." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={script}
        onChange={(e) => { setScript(e.target.value); setSaveMsg(null); }}
        rows={10}
        placeholder="Enter the script your canvassers should read at the door…"
        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />

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

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Saving…" : "Save script"}
        </button>
        {script && (
          <button
            onClick={() => { setScript(""); setSaveMsg(null); }}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
