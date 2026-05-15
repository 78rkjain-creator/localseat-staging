"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { ColumnMapping, MappingState, MappableField } from "@/lib/column-mapping";
import { FIELD_DEFS, getFieldOptions } from "@/lib/column-mapping";

// ── Types ───────────────────────────────────────────────────────────────────

interface ColumnMapperProps {
  mapping: MappingState;
  onConfirm: (columns: ColumnMapping[]) => void;
  onBack: () => void;
  customFields?: { id: string; label: string }[];
}

// ── Confidence badge ────────────────────────────────────────────────────────

function ConfidenceDot({ confidence }: { confidence: "high" | "medium" | "none" }) {
  if (confidence === "high") {
    return (
      <span
        title="High confidence match"
        className="inline-block w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"
      />
    );
  }
  if (confidence === "medium") {
    return (
      <span
        title="Possible match — please verify"
        className="inline-block w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
      />
    );
  }
  return (
    <span
      title="No match found"
      className="inline-block w-2 h-2 rounded-full bg-slate-300 flex-shrink-0"
    />
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function ColumnMapper({ mapping, onConfirm, onBack, customFields }: ColumnMapperProps) {
  // Start with suggestions pre-filled but not confirmed.
  // The user must review and hit "Confirm mapping".
  const [columns, setColumns] = useState<ColumnMapping[]>(() =>
    mapping.columns.map((col) => ({
      ...col,
      // Pre-select the suggestion so dropdowns show the guess,
      // but we treat everything as unconfirmed until they click confirm.
      confirmedField: col.suggestedField ?? "__ignore__",
    })),
  );

  const fieldOptions = useMemo(() => getFieldOptions(customFields), [customFields]);

  // Track which fields are already assigned (to warn about duplicates)
  const assignedFields = useMemo(() => {
    const counts = new Map<string, number>();
    for (const col of columns) {
      const f = col.confirmedField;
      if (f && f !== "__ignore__") {
        counts.set(f, (counts.get(f) ?? 0) + 1);
      }
    }
    return counts;
  }, [columns]);

  // Check which required fields are missing
  const missingRequired = useMemo(() => {
    const mapped = new Set<MappableField>();
    for (const col of columns) {
      const f = col.confirmedField;
      if (f && f !== "__ignore__") mapped.add(f as MappableField);
    }
    return FIELD_DEFS.filter((def) => def.required && !mapped.has(def.key));
  }, [columns]);

  // Count how many columns have a non-ignore mapping
  const mappedCount = columns.filter(
    (c) => c.confirmedField && c.confirmedField !== "__ignore__",
  ).length;

  // Any duplicate assignments?
  const hasDuplicates = Array.from(assignedFields.values()).some((n) => n > 1);

  function handleFieldChange(index: number, value: string) {
    setColumns((prev) =>
      prev.map((col, i) =>
        i === index
          ? { ...col, confirmedField: value as MappableField | "__ignore__" }
          : col,
      ),
    );
  }

  function handleConfirm() {
    onConfirm(columns);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3">
        <p className="text-sm text-blue-800">
          We detected <strong>{columns.length}</strong> column{columns.length !== 1 ? "s" : ""} in your file.
          Review each mapping below and adjust if needed, then confirm.
        </p>
      </div>

      {/* Mapping table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span>Your column</span>
          <span className="w-5" />
          <span>Maps to</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {columns.map((col, idx) => {
            const isDuplicate =
              col.confirmedField &&
              col.confirmedField !== "__ignore__" &&
              (assignedFields.get(col.confirmedField) ?? 0) > 1;

            return (
              <div
                key={idx}
                className={[
                  "grid grid-cols-[1fr_auto_1fr] gap-2 px-4 py-3 items-center",
                  isDuplicate ? "bg-red-50" : "bg-white",
                ].join(" ")}
              >
                {/* Original header */}
                <div className="flex items-center gap-2 min-w-0">
                  <ConfidenceDot confidence={col.confidence} />
                  <span className="text-sm text-slate-800 font-medium truncate">
                    {col.originalHeader}
                  </span>
                </div>

                {/* Arrow */}
                <svg
                  className="h-4 w-4 text-slate-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>

                {/* Field dropdown */}
                <div className="flex flex-col gap-1">
                  <select
                    value={col.confirmedField ?? "__ignore__"}
                    onChange={(e) => handleFieldChange(idx, e.target.value)}
                    className={[
                      "w-full h-9 rounded-lg border px-2.5 text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-brand-400",
                      "bg-white",
                      isDuplicate
                        ? "border-red-300 text-red-700"
                        : col.confirmedField === "__ignore__"
                        ? "border-slate-200 text-slate-400"
                        : "border-slate-200 text-slate-800",
                    ].join(" ")}
                  >
                    {fieldOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {isDuplicate && (
                    <span className="text-[11px] text-red-600">
                      This field is assigned to multiple columns
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data preview */}
      {mapping.sampleRows.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Preview — first {mapping.sampleRows.length} row{mapping.sampleRows.length !== 1 ? "s" : ""}
          </p>
          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {columns
                    .filter((c) => c.confirmedField && c.confirmedField !== "__ignore__")
                    .map((col, i) => {
                      const def = FIELD_DEFS.find((d) => d.key === col.confirmedField);
                      const cfMatch = col.confirmedField?.startsWith("custom:")
                        ? customFields?.find((cf) => cf.id === col.confirmedField!.slice(7))
                        : null;
                      return (
                        <th
                          key={i}
                          className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap"
                        >
                          {def?.label ?? cfMatch?.label ?? col.confirmedField}
                        </th>
                      );
                    })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mapping.sampleRows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {columns
                      .filter((c) => c.confirmedField && c.confirmedField !== "__ignore__")
                      .map((col, colIdx) => (
                        <td
                          key={colIdx}
                          className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate"
                        >
                          {row[col.originalHeader] || (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warnings */}
      {missingRequired.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
          <p className="text-sm text-amber-800">
            <strong>Missing required fields:</strong>{" "}
            {missingRequired.map((f) => f.label).join(", ")}.
            Rows without these will be flagged for review.
          </p>
        </div>
      )}

      {hasDuplicates && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm text-red-700">
            Some fields are mapped to multiple columns. Fix the duplicates before continuing.
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>
          {mappedCount} of {columns.length} column{columns.length !== 1 ? "s" : ""} mapped
        </span>
        <span className="text-slate-300">·</span>
        <span>
          {columns.length - mappedCount} ignored
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <div className="flex-1" />
        <Button onClick={handleConfirm} disabled={hasDuplicates || mappedCount === 0}>
          Confirm mapping
        </Button>
      </div>
    </div>
  );
}
