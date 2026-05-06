"use client";

import { useState, useRef, useTransition } from "react";
import { submitDataUpload, type UploadResult } from "./actions";

const FIELD_LABELS: Record<string, string> = {
  firstName: "First Name", lastName: "Last Name", streetNumber: "Street #",
  streetName: "Street Name", city: "City", province: "Province", postalCode: "Postal Code",
};

export function UploadSection() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [supplierNote, setSupplierNote] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(file: File) {
    setSelectedFile(file);
    setResult(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function handleUpload() {
    if (!selectedFile || isPending) return;
    const formData = new FormData();
    formData.set("file", selectedFile);
    formData.set("supplierNote", supplierNote);

    startTransition(async () => {
      const res = await submitDataUpload(formData);
      setResult(res);
      if (!res.error) {
        setSelectedFile(null);
        setSupplierNote("");
      }
    });
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (result && !result.error) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div
          className={[
            "rounded-xl px-4 py-3 mb-4 border",
            (result.errorCount ?? 0) === 0
              ? "bg-emerald-50 border-emerald-100"
              : "bg-amber-50 border-amber-100",
          ].join(" ")}
        >
          <p className="text-sm font-semibold text-slate-900 mb-0.5">Upload complete</p>
          <p className="text-sm text-slate-600">
            {result.recordCount?.toLocaleString()} records found{" · "}
            {result.validCount?.toLocaleString()} valid{" · "}
            {result.errorCount?.toLocaleString()} errors
          </p>
        </div>

        {result.errors && result.errors.length > 0 && (
          <div className="max-h-64 overflow-y-auto bg-white rounded-lg border border-slate-100 p-3 mt-3 mb-4">
            {result.errors.map((err, i) => (
              <div key={i} className="py-1.5 border-b border-slate-50 last:border-0 text-xs">
                <span className="text-slate-400 mr-2">Row {err.rowNum}</span>
                <span className="text-slate-700">
                  {err.firstName} {err.lastName} —{" "}
                </span>
                <span className="text-red-600">
                  Missing: {err.missingFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-sm text-slate-600 mb-4">
          Submitted for review — the campaign team will review and approve your data before it's merged.
        </p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="w-full h-10 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
        >
          Upload another file
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900">Upload data file</h2>
        <a
          href="/api/voter-list/template"
          download
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download template
        </a>
      </div>

      {result?.error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4">
          {result.error}
        </p>
      )}

      {!selectedFile ? (
        /* Drop zone */
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={[
            "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors",
            isDragOver
              ? "border-brand-400 bg-brand-50"
              : "border-slate-200 hover:border-slate-300",
          ].join(" ")}
        >
          <svg className="h-8 w-8 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <p className="text-sm text-slate-500">
            Drop your CSV or Excel file here, or click to browse
          </p>
          <p className="text-xs text-slate-400 mt-1">Supports .csv and .xlsx files</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
        </div>
      ) : (
        /* File selected */
        <div>
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 mb-4">
            <svg className="h-5 w-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{selectedFile.name}</p>
              <p className="text-xs text-slate-400">{formatBytes(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedFile(null); setResult(null); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
            >
              Cancel
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Note for the campaign team{" "}
              <span className="text-xs text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={supplierNote}
              onChange={(e) => setSupplierNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
              placeholder="Any context the campaign team should know about this upload…"
            />
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={isPending}
            className="w-full h-11 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {isPending ? "Uploading…" : "Upload"}
          </button>
        </div>
      )}
    </div>
  );
}
