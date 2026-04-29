"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { classifyRow } from "@/lib/csv-import";
import type { ReviewRow, ReviewBucket } from "@/lib/csv-import";
import { buildVoterExportCsv, triggerCsvDownload } from "@/lib/import-export";

type ExportModalProps = {
  open: boolean;
  onClose: () => void;
  rows: ReviewRow[];
  originalHeaders: string[];
};

export function ExportFixModal({ open, onClose, rows, originalHeaders }: ExportModalProps) {
  const [selected, setSelected] = useState({
    missing_required: false,
    incomplete: false,
    duplicate: false,
  });
  const [includeAnnotation, setIncludeAnnotation] = useState(true);

  const counts = {
    missing_required: rows.filter((r) => classifyRow(r) === "missing_required").length,
    incomplete:       rows.filter((r) => classifyRow(r) === "incomplete").length,
    duplicate:        rows.filter((r) => classifyRow(r) === "duplicate").length,
  };

  const totalSelected =
    (selected.missing_required ? counts.missing_required : 0) +
    (selected.incomplete       ? counts.incomplete       : 0) +
    (selected.duplicate        ? counts.duplicate        : 0);

  function handleExport() {
    const wanted = new Set<ReviewBucket>();
    if (selected.missing_required) wanted.add("missing_required");
    if (selected.incomplete)       wanted.add("incomplete");
    if (selected.duplicate)        wanted.add("duplicate");

    const csv = buildVoterExportCsv(rows, originalHeaders, wanted, includeAnnotation);
    const date = new Date().toISOString().split("T")[0];
    triggerCsvDownload(csv, `voter-import-rows-to-fix-${date}.csv`);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Export rows to fix in Excel" maxWidth="max-w-md">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-slate-500">
          Select which groups to export. A CSV file will download that you can fix in Excel and re-import.
        </p>

        <div className="flex flex-col gap-2">
          <ExportCheckRow
            label="Missing required fields"
            description="Rows missing names, location, or phone number."
            count={counts.missing_required}
            checked={selected.missing_required}
            onChange={(v) => setSelected((s) => ({ ...s, missing_required: v }))}
          />
          <ExportCheckRow
            label="Importable but incomplete"
            description="Rows missing optional data (email or address)."
            count={counts.incomplete}
            checked={selected.incomplete}
            onChange={(v) => setSelected((s) => ({ ...s, incomplete: v }))}
          />
          <ExportCheckRow
            label="Possible duplicates"
            description="Rows flagged as matching an existing record."
            count={counts.duplicate}
            checked={selected.duplicate}
            onChange={(v) => setSelected((s) => ({ ...s, duplicate: v }))}
          />
        </div>

        <hr className="border-slate-100" />

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeAnnotation}
            onChange={(e) => setIncludeAnnotation(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
          <div>
            <p className="text-sm font-medium text-slate-700">Include &ldquo;Missing fields&rdquo; annotation column</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Adds a column listing what each row is missing — makes it easier to fix in Excel.
            </p>
          </div>
        </label>

        <div className="flex items-center gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <div className="flex-1" />
          <Button onClick={handleExport} disabled={totalSelected === 0}>
            {totalSelected > 0
              ? `Export ${totalSelected} row${totalSelected !== 1 ? "s" : ""}`
              : "Export"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ExportCheckRow({
  label,
  description,
  count,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  count: number;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const disabled = count === 0;
  return (
    <label
      className={[
        "flex items-start gap-3 p-3 rounded-xl border transition-colors",
        disabled
          ? "border-slate-100 bg-slate-50 cursor-not-allowed opacity-60"
          : checked
          ? "border-brand-200 bg-brand-50 cursor-pointer"
          : "border-slate-200 bg-white cursor-pointer hover:bg-slate-50",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
            {count}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </label>
  );
}
