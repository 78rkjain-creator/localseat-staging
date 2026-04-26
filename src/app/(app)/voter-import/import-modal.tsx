"use client";

import { useState, useTransition, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { importVoterRows, checkDuplicatesForImport } from "./actions";
import type { VoterCsvRow, FlaggedRow } from "./actions";
import {
  parseCsvToReviewRows,
  getMissingFields,
  FIELD_LABELS,
  MANDATORY_FIELDS,
} from "@/lib/csv-import";
import type { ReviewRow, RowFields, RowStatus, CustomFieldDef } from "@/lib/csv-import";

// ── Local constants ────────────────────────────────────────────────────────

const BASE_COLUMNS: (keyof RowFields)[] = [
  "firstName", "lastName", "streetNumber", "streetName",
  "unitNumber", "city", "province", "postalCode",
];
const EXTRA_COLUMNS: (keyof RowFields)[] = ["phoneHome", "phoneMobile", "email", "birthDate"];

type Step = "upload" | "review" | "done";

// ── Component ─────────────────────────────────────────────────────────────

interface VoterImportModalProps {
  open: boolean;
  onClose: () => void;
  customFields?: CustomFieldDef[];
}

export function VoterImportModal({ open, onClose, customFields }: VoterImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [listImportType, setListImportType] = useState<"list" | "official_voters_list" | "telephone_list">("list");
  const [listName, setListName] = useState("");
  const [listNameError, setListNameError] = useState<string | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [result, setResult] = useState<{
    matched: number;
    created: number;
    skipped: number;
    flaggedRows: FlaggedRow[];
  } | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [birthYearWarningCount, setBirthYearWarningCount] = useState(0);

  function handleClose() {
    if (fileRef.current) fileRef.current.value = "";
    setStep("upload");
    setListImportType("list");
    setListName("");
    setListNameError(null);
    setReviewRows([]);
    setFileError(null);
    setSubmitError(null);
    setResult(null);
    setBirthYearWarningCount(0);
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileError(null);
    setReviewRows([]);

    if ((listImportType === "list" || listImportType === "telephone_list") && !listName.trim()) {
      setListNameError("Enter a list name before selecting a file.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setListNameError(null);

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
    const { rows, fileError: err, birthYearWarningCount: bywc } = parseCsvToReviewRows(text, customFields);
    if (err) { setFileError(err); return; }

    if (rows.length > 2000) {
      setFileError("File contains more than 2,000 rows. Split the file and import in batches.");
      return;
    }

    // Check for duplicates against existing records before showing review step
    setIsCheckingDuplicates(true);
    try {
      const csvRows: VoterCsvRow[] = rows.map((r) => ({
        firstName:    r.fields.firstName,
        lastName:     r.fields.lastName,
        streetNumber: r.fields.streetNumber,
        streetName:   r.fields.streetName,
        unitNumber:   r.fields.unitNumber,
        city:         r.fields.city,
        province:     r.fields.province,
        postalCode:   r.fields.postalCode,
        phoneHome:    r.fields.phoneHome,
        phoneMobile:  r.fields.phoneMobile,
        email:        r.fields.email,
        birthDate:    r.fields.birthDate,
        pollNumber:   r.fields.pollNumber,
      }));

      const duplicates = await checkDuplicatesForImport(csvRows);
      const dupMap = new Map(duplicates.map((d) => [d.rowIndex, d.matchedName]));

      const markedRows: ReviewRow[] = rows.map((row, idx) => {
        const matchedName = dupMap.get(idx);
        if (matchedName && row.status === "ready") {
          return { ...row, status: "duplicate" as RowStatus, duplicateOf: matchedName };
        }
        return row;
      });

      setReviewRows(markedRows);
      setBirthYearWarningCount(bywc);
    } catch {
      // If the duplicate check fails, proceed without warnings
      setReviewRows(rows);
      setBirthYearWarningCount(bywc);
    } finally {
      setIsCheckingDuplicates(false);
    }

    setStep("review");
  }

  function updateField(rowId: number, field: keyof RowFields, value: string) {
    setReviewRows((prev) =>
      prev.map((r) => r.id !== rowId ? r : { ...r, fields: { ...r.fields, [field]: value } })
    );
  }

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
        // Restore to duplicate status if it had a duplicateOf, otherwise ready/flagged
        if (r.duplicateOf) return { ...r, status: "duplicate" as RowStatus };
        return { ...r, status: (missing.length === 0 ? "ready" : "flagged") as RowStatus };
      })
    );
  }

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
        phoneHome:    r.fields.phoneHome.trim(),
        phoneMobile:  r.fields.phoneMobile.trim(),
        email:        r.fields.email.trim(),
        birthDate:    r.fields.birthDate.trim(),
        pollNumber:   r.fields.pollNumber.trim(),
        customFieldValues: r.customFieldValues,
      }));

    if (toImport.length === 0) {
      setSubmitError("No rows to import. Approve at least one flagged row, or make sure ready rows are present.");
      return;
    }

    startSubmit(async () => {
      const res = await importVoterRows(toImport, listImportType, listName.trim());
      if (res.error) {
        setSubmitError(res.error);
      } else {
        setResult({
          matched:     res.matched     ?? 0,
          created:     res.created     ?? 0,
          skipped:     res.skipped     ?? 0,
          flaggedRows: res.flaggedRows ?? [],
        });
        setStep("done");
      }
    });
  }

  const readyCount     = reviewRows.filter((r) => r.status === "ready").length;
  const flaggedCount   = reviewRows.filter((r) => r.status === "flagged").length;
  const duplicateCount = reviewRows.filter((r) => r.status === "duplicate").length;
  const approvedCount  = reviewRows.filter((r) => r.status === "approved").length;
  const rejectedCount  = reviewRows.filter((r) => r.status === "rejected").length;
  const importCount    = readyCount + approvedCount;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import voter list"
      maxWidth={step === "review" ? "max-w-6xl" : "max-w-lg"}
    >
      {step === "upload" && (
        <div className="flex flex-col gap-5">
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
              FirstName, LastName, StreetNumber, StreetName, UnitNumber, City, Province, PostalCode, PhoneHome, PhoneMobile, Email, BirthYear
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Header row required. Mandatory: FirstName, LastName, StreetNumber, StreetName, City, Province, PostalCode.
              Rows with missing mandatory fields are flagged for review. Max 2,000 rows per file.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-700">List type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setListImportType("list"); setListNameError(null); }}
                className={[
                  "flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                  listImportType === "list"
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => { setListImportType("telephone_list"); setListNameError(null); }}
                className={[
                  "flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                  listImportType === "telephone_list"
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                Telephone List
              </button>
              <button
                type="button"
                onClick={() => { setListImportType("official_voters_list"); setListNameError(null); }}
                className={[
                  "flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                  listImportType === "official_voters_list"
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                Official Voters List
              </button>
            </div>

            {(listImportType === "list" || listImportType === "telephone_list") && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">
                  List name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => { setListName(e.target.value); setListNameError(null); }}
                  placeholder="e.g. Rogers directory Apr 2026"
                  className={[
                    "h-10 w-full rounded-xl border px-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent",
                    listNameError ? "border-red-300 bg-red-50" : "border-slate-200",
                  ].join(" ")}
                />
                {listNameError && (
                  <p className="text-xs text-red-600">{listNameError}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Select file</label>
            {isCheckingDuplicates ? (
              <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
                <svg className="animate-spin h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking for duplicates…
              </div>
            ) : (
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
              />
            )}
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

      {step === "review" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <SummaryPill count={readyCount}     label="ready"             color="green" />
            {flaggedCount   > 0 && <SummaryPill count={flaggedCount}   label="need review"       color="amber" />}
            {duplicateCount > 0 && <SummaryPill count={duplicateCount} label="possible duplicate" color="orange" />}
            {approvedCount  > 0 && <SummaryPill count={approvedCount}  label="approved"           color="blue"  />}
            {rejectedCount  > 0 && <SummaryPill count={rejectedCount}  label="rejected"           color="slate" />}
          </div>

          {flaggedCount > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-sm text-amber-800">
                <strong>{flaggedCount}</strong> row{flaggedCount !== 1 ? "s" : ""} have missing mandatory fields.
                Fill in the highlighted cells, then approve or reject each row.
              </p>
            </div>
          )}

          {birthYearWarningCount > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-sm text-amber-800">
                <strong>{birthYearWarningCount}</strong> row{birthYearWarningCount !== 1 ? "s" : ""} used a Birth Year column (deprecated). Dates were set to January 1 of that year. Update the CSV to use a Birth Date column (YYYY-MM-DD) to avoid this.
              </p>
            </div>
          )}

          {duplicateCount > 0 && (
            <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3">
              <p className="text-sm text-orange-800">
                <strong>{duplicateCount}</strong> row{duplicateCount !== 1 ? "s" : ""} may already exist in your voter list.
                Review each one and choose to skip or import anyway.
              </p>
            </div>
          )}

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
            {(flaggedCount > 0 || duplicateCount > 0) && (
              <p className="text-xs text-amber-600">
                {[
                  flaggedCount  > 0 ? `${flaggedCount} row${flaggedCount !== 1 ? "s" : ""} need review` : "",
                  duplicateCount > 0 ? `${duplicateCount} possible duplicate${duplicateCount !== 1 ? "s" : ""}` : "",
                ].filter(Boolean).join(" · ")}
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

          {result.flaggedRows.length > 0 && (
            <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-left flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <svg className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-sm text-amber-800">
                  <strong>{result.flaggedRows.length}</strong>{" "}
                  voter{result.flaggedRows.length !== 1 ? "s" : ""} are outside your ward boundary and were not imported.
                </p>
              </div>
              <a
                href="/campaign-settings/ward/review"
                className="flex-shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 whitespace-nowrap transition-colors"
                onClick={handleClose}
              >
                Review and decide
              </a>
            </div>
          )}

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
  "phoneHome", "phoneMobile", "email", "birthDate",
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
  const isDuplicate  = row.status === "duplicate";
  const isEditable   = row.status === "flagged" || row.status === "approved";
  const isRejected   = row.status === "rejected";
  const isApproved   = row.status === "approved";
  const isReady      = row.status === "ready";
  const currentMissing = getMissingFields(row.fields);
  const canApprove   = row.status === "flagged" && currentMissing.length === 0;

  const rowBg = isRejected
    ? "bg-slate-50 opacity-50"
    : isDuplicate
    ? "bg-orange-50/50"
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
                {row.fields[field] || <span className="text-slate-300">—</span>}
              </span>
            )}
          </td>
        );
      })}

      <td className="px-3 py-2 whitespace-nowrap">
        {isReady      && <StatusBadge label="Ready"    color="green"  />}
        {isDuplicate  && (
          <div className="flex flex-col gap-0.5">
            <StatusBadge label="Duplicate?" color="orange" />
            <span className="text-[10px] text-orange-600 leading-tight max-w-[120px] truncate" title={`Possible duplicate of ${row.duplicateOf}`}>
              of {row.duplicateOf}
            </span>
          </div>
        )}
        {row.status === "flagged" && <StatusBadge label="Review"   color="amber"  />}
        {isApproved   && <StatusBadge label="Approved" color="blue"   />}
        {isRejected   && <StatusBadge label="Rejected" color="slate"  />}
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
        {isDuplicate && (
          <div className="flex items-center gap-1">
            <button
              onClick={onApprove}
              className="text-xs px-2 py-1 rounded-lg font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
            >
              Import anyway
            </button>
            <button
              onClick={onReject}
              className="text-xs px-2 py-1 rounded-lg font-medium bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"
            >
              Skip
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

function SummaryPill({
  count, label, color,
}: { count: number; label: string; color: "green" | "amber" | "orange" | "blue" | "slate" }) {
  const styles = {
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    slate:  "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <span className={["inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border", styles[color]].join(" ")}>
      <span className="font-bold">{count}</span> {label}
    </span>
  );
}

function StatusBadge({ label, color }: { label: string; color: "green" | "amber" | "orange" | "blue" | "slate" }) {
  const styles = {
    green:  "bg-emerald-50 text-emerald-700",
    amber:  "bg-amber-50 text-amber-700",
    orange: "bg-orange-50 text-orange-700",
    blue:   "bg-blue-50 text-blue-700",
    slate:  "bg-slate-100 text-slate-500",
  };
  return (
    <span className={["inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", styles[color]].join(" ")}>
      {label}
    </span>
  );
}
