"use client";

import type { CanvassState } from "./use-canvass-state";

interface TabScriptProps {
  state: CanvassState;
}

export function TabScript({ state }: TabScriptProps) {
  const { canvassScript, current } = state;

  if (!canvassScript) return null;

  const addr = current?.person.address;
  const personName = current
    ? `${current.person.firstName} ${current.person.lastName}`
    : "";
  const addressLine = addr
    ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
    : "";

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-2.5 z-10">
        <p className="text-xs text-slate-500 truncate">
          <span className="font-semibold text-slate-700">Canvassing:</span>{" "}
          {personName}{addressLine ? ` · ${addressLine}` : ""}
        </p>
      </div>

      {/* Script content */}
      <div className="px-4 py-4 max-w-lg mx-auto">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {canvassScript}
          </p>
        </div>
      </div>
    </div>
  );
}
