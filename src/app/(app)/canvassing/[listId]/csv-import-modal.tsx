"use client";

import { useState, useTransition, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { importCsvPeople } from "./actions";
import type { CsvRow } from "./actions";

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  listId: string;
}

type Step = "upload" | "review" | "done";

// Mandatory fields — must all be non-empty for a row to be "ready"
const MANDATORY: (keyof RowFields)[] = [
  "firstName",
  "lastName",
  "streetNumber",
  "streetName",
  "city",
  "province",
  "postalCode",
];

const FIELD_LABELS: Record<keyof RowFields, string> = {
  firstName: "First name",
  lastName: "Last name",
  streetNumber: "Street #",
  streetName: "Street name",
  unitNumber: "Unit",
  city: "City",
  province: "Province",
  postalCode: "Postal code",
};

interface RowFields {
  firstName: string;
  lastName: string;
  streetNumber: string;
  streetName: string;
  unitNumber: string;
  city: string;
  province: string;
  postalCode: string;
}

type RowStatus = "ready" | "flagged" | "approved" | "rejected";

interface ReviewRow {
  id: number;
  originalRowNum: number;
  fields: RowFields;
  missingOnParse: (keyof RowFields)[];
  status: RowStatus;
}

// ── CSV parsing helpers ────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { fields.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  fields.push(current.trim());
  return fields;
}

function normaliseKey(s: string): string {
  return s.toLowerCase().replace(/[\s_-]/g, "");
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[normaliseKey(k)];
    if (v) return v;
  }
  return "";
}

function parseCsvToReviewRows(text: string): {
  rows: ReviewRow[];
  fileError: string | null;
} {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) {
    return { rows: [], fileError: "File must have a header row and at least one data row." };
  }

  const headers = parseCsvLine(lines[0]).map(normaliseKey);
  const rows: ReviewRow[] = [];
  let id = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = values[idx] ?? ""; });

    const fields: RowFields = {
      firstName:    getField(raw, "firstname", "first_name", "first"),
      lastName:     getField(raw, "lastname", "last_name", "last"),
      streetNumber: getField(raw, "streetnumber", "street_number", "streetno", "number"),
      streetName:   getField(raw, "streetname", "street_name", "street"),
      unitNumber:   getField(raw, "unitnumber", "unit_number", "unit", "apt", "suite"),
      city:         getField(raw, "city"),
      province:     getField(raw, "province", "prov"),
      postalCode:   getField(raw, "postalcode", "postal_code", "postal", "zip"),
    };

    const missingOnParse = MANDATORY.filter((f) => !fields[f]);
    const status: RowStatus = missingOnParse.length === 0 ? "ready" : "flagged";

    rows.push({ id: id++, originalRowNum: i + 1, fields, missingOnParse, status });
  }

  if (rows.length === 0) {
    return { rows: [], fileError: "No data rows found after the header." };
  }

  return { rows, fileError: null };
}

function getMissingFields(fields: RowFields): (keyof RowFields)[] {
  return MANDATORY.filter((f) => !fields[f].trim());
}

// ── Main component ─────────────────────────────────────────────────────────

export function CsvImportModal({ open, onClose, listId }: CsvImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ matched: number; created: number; skipped: number } | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  // ── Reset ──────────────────────────────────────────────────────────────

  function handleClose() {
    if (fileRef.current) fileRef.current.value = "";
    setStep("upload");
    setReviewRows([]);
    setFileError(null);
    setSubmitError(null);
    setResult(null);
    onClose();
  }

  // ── File parse ─────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileError(null);
    setReviewRows([]);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setFileError("Please upload a .csv file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError("File must be under 5 MB.");
      return;
    }

    const text = await file.text();
    const { rows, fileError: err } = parseCsvToReviewRows(text);

    if (err) { setFileError(err); return; }
    setReviewRows(rows);
    setStep("review");
  }

  // ── Inline field edit ──────────────────────────────────────────────────

  function updateField(rowId: number, field: keyof RowFields, value: string) {
    setReviewRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r.fields, [field]: value };
        // Recalculate status: if all mandatory fields now present, can be approved
        // (don't auto-approve — user still needs to click Approve)
        return { ...r, fields: updated };
      })
    );
  }

  // ── Per-row approve/reject ─────────────────────────────────────────────

  function approveRow(rowId: number) {
    setReviewRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const missing = getMissingFields(r.fields);
        if (missing.length > 0) return r; // shouldn't happen if button is disabled
        return { ...r, status: "approved" };
      })
    );
  }

  function rejectRow(rowId: number) {
    setReviewRows((prev) =>
      prev.map((r) =>
        r.id !== rowId ? r : { ...r, status: "rejected" }
      )
    );
  }

  function undoRow(rowId: number) {
    setReviewRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const missing = getMissingFields(r.fields);
        return { ...r, status: missing.length === 0 ? "ready" : "flagged" };
      })
    );
  }

  // ── Confirm import ─────────────────────────────────────────────────────

  function handleConfirm() {
    setSubmitError(null);
    const toImport: CsvRow[] = reviewRows
      .filter((r) => r.status === "ready" || r.status === "approved")
      .map((r) => ({
        firstName:    r.fields.firstName.trim(),
        lastName:     r.fields.lastName.trim(),
        streetNumber: r.fields.streetNumber.trim(),
        streetName:   r.fields.streetName.trim(),
        unitNumber:   r.fields.unitNumber.trim(),
        city:         r.fields.city.trim(),
        province:     r.fields.province.trim(),
        postalCode:   r.fields.postalCode.trim(),
      }));

    if (toImport.length === 0) {
      setSubmitError("No rows to import. Approve at least one flagged row or make sure ready rows are present.");
      return;
    }

    startSubmit(async () => {
      const res = await importCsvPeople(listId, toImport);
      if (res.error) {
        setSubmitError(res.error);
      } else {
        setResult({
          matched: res.matched ?? 0,
          created: res.created ?? 0,
          skipped: res.skipped ?? 0,
        });
        setStep("done");
      }
    });
  }

  // ── Counts ─────────────────────────────────────────────────────────────

  const readyCount    = reviewRows.filter((r) => r.status === "ready").length;
  const flaggedCount  = reviewRows.filter((r) => r.status === "flagged").length;
  const approvedCount = reviewRows.filter((r) => r.status === "approved").length;
  const rejectedCount = reviewRows.filter((r) => r.status === "rejected").length;
  const importCount   = readyCount + approvedCount;
  const pendingFlaggedCount = flaggedCount; // still need a decision

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import CSV"
      maxWidth={step === "review" ? "max-w-5xl" : "max-w-lg"}
    >
      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Required CSV format</p>
            <p className="text-xs text-slate-500 font-mono leading-relaxed break-all">
              FirstName, LastName, StreetNumber, StreetName, UnitNumber, City, Province, PostalCode
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Header row required. UnitNumber is optional. All other columns are mandatory.
              Rows with missing fields will be flagged for review before import.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Select file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
            />
          </div>

          {fileError && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{fileError}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === "review" && (
        <div className="flex flex-col gap-4">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <SummaryPill count={readyCount} label="ready" color="green" />
            {flaggedCount > 0 && (
              <SummaryPill count={flaggedCount} label="need review" color="amber" />
            )}
            {approvedCount > 0 && (
              <SummaryPill count={approvedCount} label="approved" color="blue" />
            )}
            {rejectedCount > 0 && (
              <SummaryPill count={rejectedCount} label="rejected" color="slate" />
            )}
          </div>

          {flaggedCount > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-sm text-amber-800">
                <strong>{flaggedCount}</strong> row{flaggedCount !== 1 ? "s" : ""} have missing
                mandatory fields. Fill in the highlighted cells, then approve or reject each row.
                Only approved and ready rows will be imported.
              </p>
            </div>
          )}

          {/* Review table */}
          <div className="overflow-x-auto -mx-6 sm:-mx-8 border-t border-slate-100">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-100">
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-400 w-8">#</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">First name</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Last name</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Street #</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Street name</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Unit</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">City</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Prov</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Postal</th>
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reviewRows.map((row) => (
                  <ReviewRowComponent
                    key={row.id}
                    row={row}
                    onFieldChange={(field, value) => updateField(row.id, field, value)}
                    onApprove={() => approveRow(row.id)}
                    onReject={() => rejectRow(row.id)}
                    onUndo={() => undoRow(row.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {submitError && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="secondary"
              onClick={() => {
                setStep("upload");
                setReviewRows([]);
                if (fileRef.current) fileRef.current.value = "";
              }}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <div className="flex-1" />
            {pendingFlaggedCount > 0 && (
              <p className="text-xs text-amber-600">
                {pendingFlaggedCount} row{pendingFlaggedCount !== 1 ? "s" : ""} still need review
              </p>
            )}
            <Button
              onClick={handleConfirm}
              loading={isSubmitting}
              disabled={importCount === 0}
            >
              Import {importCount} {importCount === 1 ? "person" : "people"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ── */}
      {step === "done" && result && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900 mb-1">Import complete</p>
            <p className="text-sm text-slate-500">
              {result.matched} matched existing record{result.matched !== 1 ? "s" : ""}
              {" · "}
              {result.created} new record{result.created !== 1 ? "s" : ""} created
              {result.skipped > 0 && ` · ${result.skipped} skipped`}
            </p>
          </div>
          <Button onClick={handleClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
}

// ── ReviewRowComponent ─────────────────────────────────────────────────────

interface ReviewRowProps {
  row: ReviewRow;
  onFieldChange: (field: keyof RowFields, value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onUndo: () => void;
}

const EDITABLE_FIELDS: (keyof RowFields)[] = [
  "firstName", "lastName", "streetNumber", "streetName",
  "unitNumber", "city", "province", "postalCode",
];

function ReviewRowComponent({ row, onFieldChange, onApprove, onReject, onUndo }: ReviewRowProps) {
  const isEditable = row.status === "flagged" || row.status === "approved";
  const isRejected = row.status === "rejected";
  const isReady    = row.status === "ready";
  const isApproved = row.status === "approved";

  const currentMissing = getMissingFields(row.fields);
  const canApprove = row.status === "flagged" && currentMissing.length === 0;

  const rowBg = isRejected
    ? "bg-slate-50 opacity-50"
    : row.status === "flagged"
    ? "bg-amber-50/40"
    : isApproved
    ? "bg-blue-50/40"
    : "bg-white";

  function CellValue({ field }: { field: keyof RowFields }) {
    const isMissing = MANDATORY.includes(field) && !row.fields[field].trim();

    if (isEditable) {
      return (
        <input
          type="text"
          value={row.fields[field]}
          onChange={(e) => onFieldChange(field, e.target.value)}
          placeholder={FIELD_LABELS[field]}
          className={[
            "w-full text-xs px-2 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-brand-400",
            isMissing
              ? "border-amber-300 bg-amber-50 placeholder:text-amber-400"
              : "border-slate-200 bg-white",
          ].join(" ")}
        />
      );
    }

    return (
      <span className={["text-xs", isRejected ? "line-through text-slate-400" : "text-slate-700"].join(" ")}>
        {row.fields[field] || (field === "unitNumber" ? "" : <span className="text-slate-300">—</span>)}
      </span>
    );
  }

  return (
    <tr className={rowBg}>
      <td className="px-3 py-2 text-xs text-slate-400">{row.originalRowNum}</td>
      <td className="px-3 py-2"><CellValue field="firstName" /></td>
      <td className="px-3 py-2"><CellValue field="lastName" /></td>
      <td className="px-3 py-2"><CellValue field="streetNumber" /></td>
      <td className="px-3 py-2"><CellValue field="streetName" /></td>
      <td className="px-3 py-2"><CellValue field="unitNumber" /></td>
      <td className="px-3 py-2"><CellValue field="city" /></td>
      <td className="px-3 py-2"><CellValue field="province" /></td>
      <td className="px-3 py-2"><CellValue field="postalCode" /></td>

      {/* Status badge */}
      <td className="px-3 py-2 whitespace-nowrap">
        {isReady    && <StatusBadge label="Ready"    color="green" />}
        {row.status === "flagged"  && <StatusBadge label="Review"   color="amber" />}
        {isApproved && <StatusBadge label="Approved" color="blue"  />}
        {isRejected && <StatusBadge label="Rejected" color="slate" />}
      </td>

      {/* Actions */}
      <td className="px-3 py-2 whitespace-nowrap">
        {row.status === "flagged" && (
          <div className="flex items-center gap-1">
            <button
              onClick={onApprove}
              disabled={!canApprove}
              className={[
                "text-xs px-2 py-1 rounded-lg font-medium transition-colors",
                canApprove
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed",
              ].join(" ")}
              title={canApprove ? "Approve" : "Fill in all required fields first"}
            >
              Approve
            </button>
            <button
              onClick={onReject}
              className="text-xs px-2 py-1 rounded-lg font-medium bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"
            >
              Reject
            </button>
          </div>
        )}
        {(isApproved || isRejected) && (
          <button
            onClick={onUndo}
            className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
          >
            Undo
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Small display components ───────────────────────────────────────────────

function SummaryPill({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: "green" | "amber" | "blue" | "slate";
}) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue:  "bg-blue-50 text-blue-700 border-blue-200",
    slate: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <span className={["inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border", styles[color]].join(" ")}>
      <span className="font-bold">{count}</span> {label}
    </span>
  );
}

function StatusBadge({ label, color }: { label: string; color: "green" | "amber" | "blue" | "slate" }) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue:  "bg-blue-50 text-blue-700",
    slate: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={["inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", styles[color]].join(" ")}>
      {label}
    </span>
  );
}

