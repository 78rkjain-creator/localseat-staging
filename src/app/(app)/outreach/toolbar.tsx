"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogEntryModal } from "./log-entry-modal";
import { importOutreachResults } from "./actions";
import type { OutreachChannel, SupportLevel } from "@/types";
import { OUTREACH_CHANNEL_LABELS, SUPPORT_LEVEL_LABELS } from "@/types";

const CHANNELS = Object.entries(OUTREACH_CHANNEL_LABELS) as [OutreachChannel, string][];
const SUPPORT_LEVELS = Object.entries(SUPPORT_LEVEL_LABELS) as [SupportLevel, string][];

interface Props {
  campaignId: string;
}

export function OutreachToolbar({ campaignId }: Props) {
  const router = useRouter();
  const [showLogModal, setShowLogModal] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportChannel, setExportChannel] = useState<OutreachChannel>("phone_call");
  const [exportSupportLevel, setExportSupportLevel] = useState<SupportLevel | "">("");
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isImporting, startImport] = useTransition();
  const [importResult, setImportResult] = useState<{
    imported: number;
    unmatched: { firstName: string; lastName: string; address: string }[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleExportTemplate() {
    const params = new URLSearchParams({ channel: exportChannel });
    if (exportSupportLevel) params.set("supportLevel", exportSupportLevel);
    window.location.href = `/api/outreach/export-template?${params.toString()}`;
  }

  function handleExportHistory() {
    window.location.href = `/api/outreach/export-history`;
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) { setImportError("No data rows found in file."); return; }

      startImport(async () => {
        const result = await importOutreachResults(rows);
        if (result.error) { setImportError(result.error); return; }
        setImportResult(result);
        router.refresh();
      });
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex items-center gap-2">
      {/* Log entry */}
      <button
        type="button"
        onClick={() => setShowLogModal(true)}
        className="h-10 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors whitespace-nowrap"
      >
        + Log entry
      </button>

      {/* Export list — opens panel with channel + support level */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowExportPanel((v) => !v); setShowImport(false); }}
          className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
        >
          Export list
        </button>
        {showExportPanel && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-lg p-4 z-20">
            <p className="text-sm font-semibold text-slate-800 mb-3">Export voter list</p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600">Channel</label>
                <select
                  value={exportChannel}
                  onChange={(e) => setExportChannel(e.target.value as OutreachChannel)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {CHANNELS.filter(([v]) => v !== "door_knock").map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600">Support level</label>
                <select
                  value={exportSupportLevel}
                  onChange={(e) => setExportSupportLevel(e.target.value as SupportLevel | "")}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">All voters</option>
                  {SUPPORT_LEVELS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => { handleExportTemplate(); setShowExportPanel(false); }}
                className="h-10 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
              >
                Download CSV
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Export history */}
      <button
        type="button"
        onClick={handleExportHistory}
        className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
      >
        Export all history
      </button>

      {/* Import results */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setShowImport((v) => !v); setShowExportPanel(false); }}
          className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 font-medium hover:bg-slate-50 transition-colors"
        >
          Import results
        </button>

        {showImport && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-lg p-4 z-20">
            <p className="text-sm font-medium text-slate-800 mb-2">Upload filled-in template</p>
            <p className="text-xs text-slate-500 mb-3">
              Match by phone number first, then by first + last name.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleImportFile}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:text-sm file:font-medium hover:file:bg-slate-200 cursor-pointer"
            />
            {isImporting && <p className="text-xs text-slate-500 mt-2">Importing…</p>}
            {importError && <p className="text-xs text-red-600 mt-2">{importError}</p>}
            {importResult && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-emerald-700 font-medium">
                  ✓ {importResult.imported} entr{importResult.imported === 1 ? "y" : "ies"} imported
                </p>
                {importResult.unmatched.length > 0 && (
                  <>
                    <p className="text-xs text-amber-700 font-medium">
                      {importResult.unmatched.length} record{importResult.unmatched.length === 1 ? "" : "s"} not matched in voter list:
                    </p>
                    <ul className="text-xs text-slate-500 space-y-0.5 max-h-32 overflow-y-auto">
                      {importResult.unmatched.map((u, i) => (
                        <li key={i}>{u.firstName} {u.lastName}{u.address ? ` — ${u.address}` : ""}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={() => { setShowImport(false); setImportResult(null); setImportError(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      <LogEntryModal
        campaignId={campaignId}
        open={showLogModal}
        onClose={() => { setShowLogModal(false); router.refresh(); }}
      />
    </div>
  );
}

// ── Minimal CSV parser ─────────────────────────────────────────────────────
// Expects headers: First Name, Last Name, Address, Phone, Email,
//                  Channel, Date, Outcome, Notes, Phoned By, Phone Type

function parseCsv(text: string): import("./actions").ImportedOutreachRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = splitCsvRow(lines[0]).map((h) => h.trim().toLowerCase());

  const idx = (name: string) => headers.indexOf(name);
  const iFirstName = idx("first name");
  const iLastName  = idx("last name");
  const iAddress   = idx("address");
  const iPhone     = idx("phone");
  const iChannel   = idx("channel");
  const iDate      = idx("date");
  const iOutcome   = idx("outcome");
  const iNotes     = idx("notes");
  const iPhonedBy  = idx("phoned by");
  const iPhoneType = idx("phone type");

  if (iFirstName < 0 || iLastName < 0) return [];

  const rows: import("./actions").ImportedOutreachRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    if (cols.every((c) => !c.trim())) continue;

    const channel = (iChannel >= 0 ? cols[iChannel]?.trim() : "") || "other";

    rows.push({
      firstName: cols[iFirstName]?.trim() ?? "",
      lastName:  cols[iLastName]?.trim() ?? "",
      address:   iAddress >= 0 ? (cols[iAddress]?.trim() ?? "") : "",
      phone:     iPhone >= 0 ? (cols[iPhone]?.trim() ?? "") : "",
      channel:   channel as OutreachChannel,
      date:      iDate >= 0 ? (cols[iDate]?.trim() ?? "") : "",
      outcome:   iOutcome >= 0 ? (cols[iOutcome]?.trim() ?? "") : "",
      notes:     iNotes >= 0 ? (cols[iNotes]?.trim() ?? "") : "",
      phonedBy:  iPhonedBy >= 0 ? (cols[iPhonedBy]?.trim() ?? "") : "",
      phoneType: iPhoneType >= 0 ? (cols[iPhoneType]?.trim() ?? "") : "",
    });
  }

  return rows;
}

function splitCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
