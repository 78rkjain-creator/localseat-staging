"use client";

import { useState, useTransition, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { importVoterRows } from "./actions";
import type { VoterCsvRow } from "./actions";
import {
  parseCsvToReviewRows,
  getMissingFields,
  FIELD_LABELS,
  MANDATORY_FIELDS,
} from "@/lib/csv-import";
import type { ReviewRow, RowFields, RowStatus } from "@/lib/csv-import";

// ── Local constants ────────────────────────────────────────────────────────

// Display order for table columns (base address fields first, then optional)
const BASE_COLUMNS: (keyof RowFields)[] = [
  "firstName", "lastName", "streetNumber", "streetName",
  "unitNumber", "city", "province", "postalCode",
];
const EXTRA_COLUMNS: (keyof RowFields)[] = ["phone", "email", "birthYear"];

type Step = "upload" | "review" | "done";

// ── Component ─────────────────────────────────────────────────────────────

interface VoterImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function VoterImportModal({ open, onClose }: VoterImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    matched: number;
    created: number;
    skipped: number;
  } | null>(null);
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
    if (file.size > 10 * 1024 * 1024) {
      setFileError("File must be under 10 MB.");
      return;
    }

    const text = await file.text();
    const { rows, fileError: err } = parseCsvToReviewRows(text);
    if (err) { setFileError(err); return; }

    if (rows.length > 2000) {
      setFileError("File contains more than 2,000 rows. Split the file and import in batches.");
      return;
    }

    setReviewRows(rows);
    setStep("review");
  }

  // ── Inline field edit ──────────────────────────────────────────────────

  function updateField(rowId: number, field: keyof RowFields, value: string) {
    setReviewRows((prev) =>
      prev.map((r) => r.id !== rowId ? r : { ...r, fields: { ...r.fields, [field]: value } })
    );
  }

  // ── Per-row status ─────────────────────────────────────────────────────

  function approveRow(rowId: number) {
    setReviewRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        if (getMissingFields(r.fields).length > 0) return r;
        return { ...r, status: "approved" as const };
      })
    );
  }

  function rejectRow(rowId: number) {
    setReviewRows((prev) =>
      prev.map((r) => r.id !== rowId ? r : { ...r, status: "rejected" as const })
    );
  }

  function undoRow(rowId: number) {
    setReviewRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const missing = getMissingFields(r.fields);
        return { ...r, status: (missing.length === 0 ? "ready" : "flagged") as RowStatus };
      })
    );
  }

  // ── Confirm import ─────────────────────────────────────────────────────

  function handleConfirm() {
    setSubmitError(null);
    const toImport: VoterCsvRow[] = reviewRows
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
        phone:        r.fields.phone.trim(),
        email:        r.fields.email.trim(),
        birthYear:    r.fields.birthYear.trim(),
      }));

    if (toImport.length === 0) {
      setSubmitError("No rows to import. Approve at least one flagged row, or make sure ready rows are present.");
      return;
    }

    startSubmit(async () => {
      const res = await importVoterRows(toImport);
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

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import voter list"
      maxWidth={step === "review" ? "max-w-6xl" : "max-w-lg"}
    >
      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div className="flex flex-col gap-5">
          {/* Template download */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-sm font-medium text-slate-700">CSV format</p>
              <a
                href="/api/voter-list/template"
                download
                className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1 flex-shrink-0"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Download template
              </a>
            </div>
            <p className="text-xs text-slate-500 font-mono leading-relaxed break-all">
              FirstName, LastName, StreetNumber, StreetName, UnitNumber, City, Province, PostalCode, Phone, Email, BirthYear
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Header row required. Mandatory: FirstName, LastName, StreetNumber, StreetName, City, Province, PostalCode.
              Rows with missing mandatory fields are flagged for review. Max 2,000 rows per file.
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
          {/* Summary pills */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <SummaryPill count={readyCount}    label="ready"       color="green" />
            {flaggedCount  > 0 && <SummaryPill count={flaggedCount}  label="need review" color="amber" />}
            {approvedCount > 0 && <SummaryPill count={approvedCount} label="approved"    color="blue"  />}
            {rejectedCount > 0 && <SummaryPill count={rejectedCount} label="rejected"    color="slate" />}
          </div>

          {flaggedCount > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-sm text-amber-800">
                <strong>{flaggedCount}</strong> row{flaggedCount !== 1 ? "s" : ""} have missing mandatory fields.
                Fill in the highlighted cells, then approve or reject each row.
              </p>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto -mx-6 sm:-mx-8 border-t border-slate-100">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-100">
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-400 w-8">#</th>
                  {[...BASE_COLUMNS, ...EXTRA_COLUMNS].map((col) => (
                    <th key={col} className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {FIELD_LABELS[col]}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5" />
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
            {flaggedCount > 0 && (
              <p className="text-xs text-amber-600">
                {flaggedCount} row{flaggedCount !== 1 ? "s" : ""} still need review
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

const ALL_COLUMNS: (keyof RowFields)[] = [
  "firstName", "lastName", "streetNumber", "streetName",
  "unitNumber", "city", "province", "postalCode",
  "phone", "email", "birthYear",
];

function ReviewRowComponent({
  row,
  onFieldChange,
  onApprove,
  onReject,
  onUndo,
}: {
  row: ReviewRow;
  onFieldChange: (field: keyof RowFields, value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onUndo: () => void;
}) {
  const isEditable  = row.status === "flagged" || row.status === "approved";
  const isRejected  = row.status === "rejected";
  const isApproved  = row.status === "approved";
  const isReady     = row.status === "ready";
  const currentMissing = getMissingFields(row.fields);
  const canApprove  = row.status === "flagged" && currentMissing.length === 0;

  const rowBg = isRejected
    ? "bg-slate-50 opacity-50"
    : row.status === "flagged"
    ? "bg-amber-50/40"
    : isApproved
    ? "bg-blue-50/40"
    : "bg-white";

  return (
    <tr className={rowBg}>
      <td className="px-3 py-2 text-xs text-slate-400">{row.originalRowNum}</td>
      {ALL_COLUMNS.map((field) => {
        const isMandatory = MANDATORY_FIELDS.includes(field as typeof MANDATORY_FIELDS[number]);
        const isMissing = isMandatory && !row.fields[field].trim();

        return (
          <td key={field} className="px-3 py-2">
            {isEditable ? (
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
            ) : (
              <span className={["text-xs", isRejected ? "line-through text-slate-400" : "text-slate-700"].join(" ")}>
                {row.fields[field] || (field === "unitNumber" || !isMandatory ? (
                  <span className="text-slate-300">—</span>
                ) : (
                  <span className="text-slate-300">—</span>
                ))}
              </span>
            )}
          </td>
        );
      })}

      <td className="px-3 py-2 whitespace-nowrap">
        {isReady    && <StatusBadge label="Ready"    color="green" />}
        {row.status === "flagged" && <StatusBadge label="Review"   color="amber" />}
        {isApproved && <StatusBadge label="Approved" color="blue"  />}
        {isRejected && <StatusBadge label="Rejected" color="slate" />}
      </td>

      <td className="px-3 py-2 whitespace-nowrap">
        {row.status === "flagged" && (
          <div className="flex items-center gap-1">
            <button
              onClick={onApprove}
              disabled={!canApprove}
              title={canApprove ? "Approve" : "Fill in all required fields first"}
              className={[
                "text-xs px-2 py-1 rounded-lg font-medium transition-colors",
                canApprove
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed",
              ].join(" ")}
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

// ── Shared small display components ────────────────────────────────────────

function SummaryPill({
  count, label, color,
}: { count: number; label: string; color: "green" | "amber" | "blue" | "slate" }) {
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
