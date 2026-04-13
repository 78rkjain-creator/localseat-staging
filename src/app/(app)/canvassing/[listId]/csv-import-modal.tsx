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

type Step = "upload" | "preview" | "done";

interface ParseError {
  row: number;
  message: string;
}

/**
 * Minimal CSV parser. Handles quoted fields and trims whitespace.
 * Returns an array of objects keyed by header row values.
 */
function parseCsv(text: string): { rows: Record<string, string>[]; errors: ParseError[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const errors: ParseError[] = [];
  const rows: Record<string, string>[] = [];

  if (lines.length < 2) return { rows, errors };

  // Parse a single CSV line respecting double-quoted fields
  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          fields.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = fields[idx] ?? "";
    });
    rows.push(row);
  }

  return { rows, errors };
}

/**
 * Map parsed CSV rows to the CsvRow shape.
 * Accepts flexible column name variants.
 */
function mapToCsvRows(raw: Record<string, string>[]): {
  rows: CsvRow[];
  parseErrors: string[];
} {
  const rows: CsvRow[] = [];
  const parseErrors: string[] = [];

  // Normalise header names — support common variants
  function get(row: Record<string, string>, ...keys: string[]): string {
    for (const k of keys) {
      const val = row[k.toLowerCase().replace(/\s+/g, "")] ?? "";
      if (val) return val;
    }
    return "";
  }

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const rowNum = i + 2; // 1-indexed, +1 for header

    const firstName = get(r, "firstname", "first_name", "first");
    const lastName = get(r, "lastname", "last_name", "last");
    const streetNumber = get(r, "streetnumber", "street_number", "number", "streetno");
    const streetName = get(r, "streetname", "street_name", "street");
    const city = get(r, "city");
    const unitNumber = get(r, "unitnumber", "unit_number", "unit", "apt", "suite");
    const postalCode = get(r, "postalcode", "postal_code", "postal", "zip");

    if (!firstName || !lastName || !streetNumber || !streetName) {
      parseErrors.push(
        `Row ${rowNum}: missing required field(s) — need FirstName, LastName, StreetNumber, StreetName`
      );
      continue;
    }

    rows.push({ firstName, lastName, streetNumber, streetName, unitNumber, city, postalCode });
  }

  return { rows, parseErrors };
}

export function CsvImportModal({ open, onClose, listId }: CsvImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ matched: number; created: number; skipped: number } | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  function handleClose() {
    if (fileRef.current) fileRef.current.value = "";
    setStep("upload");
    setRows([]);
    setParseErrors([]);
    setFileError(null);
    setSubmitError(null);
    setResult(null);
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileError(null);
    setParseErrors([]);
    setRows([]);

    if (!file) return;

    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setFileError("Please upload a .csv file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFileError("File must be under 2 MB.");
      return;
    }

    const text = await file.text();
    const { rows: rawRows } = parseCsv(text);

    if (rawRows.length === 0) {
      setFileError("No data rows found. Check the file has a header row and at least one data row.");
      return;
    }

    const { rows: mapped, parseErrors: errs } = mapToCsvRows(rawRows);
    setRows(mapped);
    setParseErrors(errs);

    if (mapped.length > 0) {
      setStep("preview");
    } else {
      setFileError("No valid rows could be parsed.");
    }
  }

  function handleConfirm() {
    setSubmitError(null);
    startSubmit(async () => {
      const res = await importCsvPeople(listId, rows);
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

  const previewRows = rows.slice(0, 10);

  return (
    <Modal open={open} onClose={handleClose} title="Import CSV" maxWidth="max-w-2xl">
      {step === "upload" && (
        <div className="flex flex-col gap-5">
          {/* Format description */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-4">
            <p className="text-sm font-medium text-slate-700 mb-2">
              Required CSV format
            </p>
            <p className="text-xs text-slate-500 font-mono leading-relaxed">
              FirstName, LastName, StreetNumber, StreetName, UnitNumber, City, PostalCode
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Header row required. UnitNumber, City, and PostalCode are optional.
              Existing people will be matched by name and address.
            </p>
          </div>

          {/* File input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Select file
            </label>
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
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{rows.length}</span> valid row
              {rows.length !== 1 ? "s" : ""} ready to import
              {parseErrors.length > 0 && (
                <span className="text-amber-600">
                  {" "}· {parseErrors.length} row{parseErrors.length !== 1 ? "s" : ""} skipped
                </span>
              )}
            </p>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto -mx-6 sm:-mx-8 border-y border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Address</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">City</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((row, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-4 py-2.5 text-slate-800">
                      {row.firstName} {row.lastName}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {row.streetNumber} {row.streetName}
                      {row.unitNumber ? ` #${row.unitNumber}` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {row.city || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <p className="px-4 py-2.5 text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
                Showing first 10 of {rows.length} rows
              </p>
            )}
          </div>

          {/* Parse warnings */}
          {parseErrors.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-sm font-medium text-amber-700 mb-1">
                {parseErrors.length} row{parseErrors.length !== 1 ? "s" : ""} will be skipped
              </p>
              <ul className="text-xs text-amber-600 space-y-0.5">
                {parseErrors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {parseErrors.length > 5 && (
                  <li>…and {parseErrors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          {submitError && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setStep("upload");
                if (fileRef.current) fileRef.current.value = "";
              }}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              fullWidth
              loading={isSubmitting}
              onClick={handleConfirm}
            >
              Import {rows.length} {rows.length === 1 ? "person" : "people"}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900 mb-1">
              Import complete
            </p>
            <p className="text-sm text-slate-500">
              {result.matched} matched existing record
              {result.matched !== 1 ? "s" : ""}
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
