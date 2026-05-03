"use client";

import { useState, useEffect, useMemo, useTransition, useRef } from "react";
import type { ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { importVoterRows, checkDuplicatesForImport, getCampaignTagsForImport } from "./actions";
import type { VoterCsvRow, FlaggedRow, TagPlan } from "./actions";
import {
  parseCsvToReviewRows,
  getMissingFields,
  listMissingFields,
  FIELD_LABELS,
  MANDATORY_FIELDS,
  parseTagList,
  classifyRow,
} from "@/lib/csv-import";
import { parseXlsxToReviewRows } from "@/lib/xlsx-import";
import type { ReviewRow, RowFields, RowStatus, CustomFieldDef, ReviewBucket } from "@/lib/csv-import";
import { ExportFixModal } from "./import-modal-export";
import { buildVoterExportCsv, triggerCsvDownload } from "@/lib/import-export";
import { splitCsvText, splitXlsxFile } from "@/lib/file-splitter";
import type { FileBatchItem } from "@/lib/file-splitter";

// ── Local constants ────────────────────────────────────────────────────────

const BASE_COLUMNS: (keyof RowFields)[] = [
  "firstName", "lastName", "streetNumber", "streetName",
  "unitNumber", "city", "province", "postalCode",
];
const EXTRA_COLUMNS: (keyof RowFields)[] = ["phoneHome", "phoneMobile", "email", "birthDate"];

type Step = "upload" | "tagReview" | "review" | "done";

type TagDecisionStatus = "pending" | "create" | "skip" | "use";
interface TagDecision {
  status: TagDecisionStatus;
  edited: string;
  resolvedTagId?: string;
}

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
    voterIdUpdated: number;
    voterIdUnchanged: number;
    duplicateCount: number;
  } | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [birthYearWarningCount, setBirthYearWarningCount] = useState(0);
  const [isSplitting, setIsSplitting] = useState(false);
  const [batchSession, setBatchSession] = useState<{
    batches: FileBatchItem[];
    totalRows: number;
    completedBatches: Set<number>;
    listName: string;
    listImportType: "list" | "official_voters_list" | "telephone_list";
  } | null>(null);
  const [activeBatchIndex, setActiveBatchIndex] = useState<number | null>(null);
  const [originalHeaders, setOriginalHeaders] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<ReviewBucket, boolean>>({
    ready: false,
    incomplete: false,
    duplicate: false,
    missing_required: false,
  });

  // Tag review state
  const [tagDecisions, setTagDecisions] = useState<Record<string, TagDecision>>({});
  const [existingTagsByLower, setExistingTagsByLower] = useState<Map<string, { id: string; name: string }>>(new Map());
  const [allTagNamesFromImport, setAllTagNamesFromImport] = useState<string[]>([]);

  // ── Derived bucket counts ──────────────────────────────────────────────

  const bucketed = useMemo(() => {
    const groups: Record<ReviewBucket, ReviewRow[]> = {
      ready: [],
      incomplete: [],
      duplicate: [],
      missing_required: [],
    };
    for (const r of reviewRows) {
      groups[classifyRow(r)].push(r);
    }
    return groups;
  }, [reviewRows]);

  const readyCount2          = bucketed.ready.length;
  const incompleteCount      = bucketed.incomplete.length;
  const duplicateCount2      = bucketed.duplicate.length;
  const missingRequiredCount = bucketed.missing_required.length;

  // Legacy status-based counts (used by summary pills and banners)
  const readyCount     = reviewRows.filter((r) => r.status === "ready").length;
  const flaggedCount   = reviewRows.filter((r) => r.status === "flagged").length;
  const duplicateCount = reviewRows.filter((r) => r.status === "duplicate").length;
  const approvedCount  = reviewRows.filter((r) => r.status === "approved").length;
  const rejectedCount  = reviewRows.filter((r) => r.status === "rejected").length;

  const importCount = readyCount2 + incompleteCount
                    + bucketed.duplicate.filter((r) => r.status === "approved").length;

  const ambiguousAddressCount = reviewRows.filter((r) => r.addressAmbiguous).length;
  const autoParsedCount       = reviewRows.filter((r) => r.addressAutoParsed && !r.addressAmbiguous).length;

  // Auto-expand small groups when entering review step
  useEffect(() => {
    if (step !== "review") return;
    setExpanded({
      ready: false,
      incomplete: false,
      duplicate: bucketed.duplicate.length > 0 && bucketed.duplicate.length < 10,
      missing_required: bucketed.missing_required.length > 0 && bucketed.missing_required.length < 10,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function toggleGroup(b: ReviewBucket) {
    setExpanded((prev) => ({ ...prev, [b]: !prev[b] }));
  }

  // ── Handlers ───────────────────────────────────────────────────────────

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
    setOriginalHeaders([]);
    setExportOpen(false);
    setExpanded({ ready: false, incomplete: false, duplicate: false, missing_required: false });
    setTagDecisions({});
    setExistingTagsByLower(new Map());
    setAllTagNamesFromImport([]);
    setBatchSession(null);
    setActiveBatchIndex(null);
    setIsSplitting(false);
    onClose();
  }

  // ── Shared: duplicate check + tag check → advance to review/tagReview ──────

  async function processRowsForReview(rows: ReviewRow[], bywc: number, hdrs: string[]) {
    setOriginalHeaders(hdrs);
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
        voterId:      r.fields.voterId,
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

      const seenTagLower = new Set<string>();
      const allTagNames: string[] = [];
      for (const r of markedRows) {
        for (const name of parseTagList(r.fields.tags)) {
          const lower = name.toLowerCase();
          if (!seenTagLower.has(lower)) {
            seenTagLower.add(lower);
            allTagNames.push(name);
          }
        }
      }
      setAllTagNamesFromImport(allTagNames);

      if (allTagNames.length > 0) {
        const { tags: existingTags } = await getCampaignTagsForImport();
        const byLower = new Map(existingTags.map((t) => [t.name.toLowerCase(), t]));
        setExistingTagsByLower(byLower);

        const unknown = allTagNames.filter((n) => !byLower.has(n.toLowerCase()));
        if (unknown.length > 0) {
          const initial: Record<string, TagDecision> = {};
          for (const name of unknown) {
            initial[name.toLowerCase()] = { status: "pending", edited: name };
          }
          setTagDecisions(initial);
          setStep("tagReview");
          return;
        }
      }
    } catch {
      setReviewRows(rows);
      setBirthYearWarningCount(bywc);
    } finally {
      setIsCheckingDuplicates(false);
    }
    setStep("review");
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

    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "csv" && ext !== "xlsx") {
      setFileError("Upload a .csv or .xlsx file.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setFileError("File must be under 25 MB.");
      return;
    }

    let rows: ReviewRow[];
    let err: string | null;
    let rowCapExceeded: boolean | undefined;
    let bywc: number;
    let hdrs: string[];
    let csvText: string | undefined;

    if (ext === "xlsx") {
      ({ rows, fileError: err, rowCapExceeded, birthYearWarningCount: bywc, originalHeaders: hdrs } =
        await parseXlsxToReviewRows(file, customFields));
    } else {
      csvText = await file.text();
      ({ rows, fileError: err, rowCapExceeded, birthYearWarningCount: bywc, originalHeaders: hdrs } =
        parseCsvToReviewRows(csvText, customFields));
    }

    if (rowCapExceeded) {
      setIsSplitting(true);
      try {
        let splitResult: { batches: FileBatchItem[]; totalRows: number; fileError: string | null };
        if (ext === "xlsx") {
          splitResult = await splitXlsxFile(file);
        } else {
          const { batches, totalRows } = splitCsvText(csvText!);
          splitResult = { batches, totalRows, fileError: null };
        }
        if (splitResult.fileError) {
          setFileError(splitResult.fileError);
          return;
        }
        setBatchSession({
          batches: splitResult.batches,
          totalRows: splitResult.totalRows,
          completedBatches: new Set(),
          listName,
          listImportType,
        });
        if (fileRef.current) fileRef.current.value = "";
      } finally {
        setIsSplitting(false);
      }
      return;
    }

    if (err) { setFileError(err); return; }

    await processRowsForReview(rows, bywc, hdrs);
  }

  async function startBatch(idx: number) {
    if (!batchSession) return;
    const batch = batchSession.batches[idx];
    setActiveBatchIndex(idx);
    setFileError(null);
    setReviewRows([]);
    setResult(null);
    setSubmitError(null);
    setBirthYearWarningCount(0);
    setTagDecisions({});
    setExistingTagsByLower(new Map());
    setAllTagNamesFromImport([]);
    setExpanded({ ready: false, incomplete: false, duplicate: false, missing_required: false });

    const { rows, fileError: err, birthYearWarningCount: bywc, originalHeaders: hdrs } =
      parseCsvToReviewRows(batch.csvText, customFields, { skipRowCap: true });

    if (err || rows.length === 0) {
      setFileError(err ?? "This batch has no data rows.");
      return;
    }

    // Use list config captured at split time
    setListName(batchSession.listName);
    setListImportType(batchSession.listImportType);

    await processRowsForReview(rows, bywc, hdrs);
  }

  function handleBackToBatches() {
    if (batchSession && activeBatchIndex !== null) {
      setBatchSession((prev) => {
        if (!prev) return null;
        const completed = new Set(prev.completedBatches);
        completed.add(activeBatchIndex);
        return { ...prev, completedBatches: completed };
      });
    }
    setActiveBatchIndex(null);
    setStep("upload");
    setReviewRows([]);
    setResult(null);
    setSubmitError(null);
    setBirthYearWarningCount(0);
    setOriginalHeaders([]);
    setTagDecisions({});
    setExistingTagsByLower(new Map());
    setAllTagNamesFromImport([]);
    setExpanded({ ready: false, incomplete: false, duplicate: false, missing_required: false });
    if (fileRef.current) fileRef.current.value = "";
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
        if (r.duplicateOf) return { ...r, status: "duplicate" as RowStatus };
        return { ...r, status: (missing.length === 0 ? "ready" : "flagged") as RowStatus };
      })
    );
  }

  function approveAllInGroup(bucket: ReviewBucket) {
    setReviewRows((prev) =>
      prev.map((r) => {
        if (classifyRow(r) !== bucket) return r;
        if (getMissingFields(r.fields).length > 0) return r;
        return { ...r, status: "approved" as const };
      }),
    );
  }

  function rejectAllInGroup(bucket: ReviewBucket) {
    setReviewRows((prev) =>
      prev.map((r) => {
        if (classifyRow(r) !== bucket) return r;
        return { ...r, status: "rejected" as const };
      }),
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
        voterId:      r.fields.voterId.trim(),
        supportLevel:     r.fields.supportLevel.trim() || undefined,
        tags:             r.fields.tags.trim() || undefined,
        notes:            r.fields.notes.trim() || undefined,
        gender:           r.fields.gender.trim() || undefined,
        isConfirmedVoter: r.fields.isConfirmedVoter.trim() || undefined,
        customFieldValues: r.customFieldValues,
      }));

    if (toImport.length === 0) {
      setSubmitError("No rows to import. Approve at least one flagged row, or make sure ready rows are present.");
      return;
    }

    // Build tag plan from decisions + known existing tags
    const tagPlan: TagPlan = { resolutions: [] };
    for (const rawName of allTagNamesFromImport) {
      const lower = rawName.toLowerCase();
      const existing = existingTagsByLower.get(lower);
      if (existing) {
        tagPlan.resolutions.push({ originalLower: lower, action: "use", tagId: existing.id });
      } else {
        const decision = tagDecisions[lower];
        if (!decision || decision.status === "skip") {
          tagPlan.resolutions.push({ originalLower: lower, action: "skip" });
        } else if (decision.status === "use" && decision.resolvedTagId) {
          tagPlan.resolutions.push({ originalLower: lower, action: "use", tagId: decision.resolvedTagId });
        } else if (decision.status === "create") {
          tagPlan.resolutions.push({ originalLower: lower, action: "create", createName: decision.edited });
        }
      }
    }

    const batchSuffix = (batchSession && activeBatchIndex !== null)
      ? ` — Batch ${activeBatchIndex + 1}`
      : "";
    startSubmit(async () => {
      const res = await importVoterRows(toImport, listImportType, listName.trim() + batchSuffix, tagPlan);
      if (res.error) {
        setSubmitError(res.error);
      } else {
        setResult({
          matched:          res.matched          ?? 0,
          created:          res.created          ?? 0,
          skipped:          res.skipped          ?? 0,
          flaggedRows:      res.flaggedRows       ?? [],
          voterIdUpdated:   res.voterIdUpdated   ?? 0,
          voterIdUnchanged: res.voterIdUnchanged ?? 0,
          duplicateCount:   res.duplicateCount   ?? 0,
        });
        setStep("done");
      }
    });
  }

  function handleExportClick() {
    const counts = {
      missing_required: bucketed.missing_required.length,
      incomplete:       bucketed.incomplete.length,
      duplicate:        bucketed.duplicate.length,
    };
    const groupsWithContent = (Object.entries(counts) as [ReviewBucket, number][]).filter(([, n]) => n > 0);
    if (groupsWithContent.length === 0) return;
    if (groupsWithContent.length === 1) {
      const onlyBucket = groupsWithContent[0][0];
      const csv = buildVoterExportCsv(reviewRows, originalHeaders, new Set([onlyBucket]));
      const date = new Date().toISOString().split("T")[0];
      triggerCsvDownload(csv, `voter-import-rows-to-fix-${date}.csv`);
      return;
    }
    setExportOpen(true);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        batchSession && activeBatchIndex !== null
          ? `Import batch ${activeBatchIndex + 1} of ${batchSession.batches.length}`
          : batchSession
          ? `Import voter list — ${batchSession.batches.length} batches`
          : "Import voter list"
      }
      maxWidth={step === "review" ? "max-w-6xl" : "max-w-lg"}
    >
      {step === "upload" && (
        <div className="flex flex-col gap-5">

          {/* ── Batch session view ──────────────────────────────────────── */}
          {isSplitting && (
            <div className="flex flex-col items-center gap-3 py-10 text-sm text-slate-500">
              <svg className="animate-spin h-5 w-5 text-brand-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Splitting file into batches…
            </div>
          )}

          {!isSplitting && batchSession && (
            <BatchSessionPanel
              session={batchSession}
              onStartBatch={startBatch}
              loadingBatchIndex={isCheckingDuplicates ? activeBatchIndex : null}
              onClose={handleClose}
            />
          )}

          {!isSplitting && !batchSession && (<>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-sm font-medium text-slate-700">XLSX / CSV format</p>
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
              Rows with missing mandatory fields are flagged for review. Files over 10,000 rows are automatically split into batches.
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
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
          </>)}
        </div>
      )}

      {step === "tagReview" && (
        <TagReviewStep
          tagDecisions={tagDecisions}
          existingTagsByLower={existingTagsByLower}
          onDecisionChange={(lower, decision) =>
            setTagDecisions((prev) => ({ ...prev, [lower]: decision }))
          }
          onBulkCreate={() =>
            setTagDecisions((prev) => {
              const next = { ...prev };
              for (const key of Object.keys(next)) {
                if (next[key].status === "pending") {
                  next[key] = { ...next[key], status: "create" };
                }
              }
              return next;
            })
          }
          onBulkSkip={() =>
            setTagDecisions((prev) => {
              const next = { ...prev };
              for (const key of Object.keys(next)) {
                if (next[key].status === "pending") {
                  next[key] = { ...next[key], status: "skip" };
                }
              }
              return next;
            })
          }
          onContinue={() => setStep("review")}
          onBack={() => {
            setStep("upload");
            setReviewRows([]);
            setTagDecisions({});
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
      )}

      {step === "review" && (
        <div className="flex flex-col gap-4">

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Review rows</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportClick}
              disabled={(missingRequiredCount + incompleteCount + duplicateCount2) === 0}
            >
              Export rows to fix
            </Button>
          </div>

          {/* Summary pills */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <SummaryPill count={readyCount2} label="ready" color="green" />
            {(incompleteCount + missingRequiredCount) > 0 && (
              <SummaryPill count={incompleteCount + missingRequiredCount} label="need review" color="amber" />
            )}
            {duplicateCount2 > 0 && <SummaryPill count={duplicateCount2} label="possible duplicate" color="orange" />}
            {rejectedCount   > 0 && <SummaryPill count={rejectedCount}   label="rejected"            color="slate" />}
          </div>

          {/* Banners */}
          {birthYearWarningCount > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-sm text-amber-800">
                <strong>{birthYearWarningCount}</strong> row{birthYearWarningCount !== 1 ? "s" : ""} used a Birth Year column (deprecated). Dates were set to January 1 of that year. Update the CSV to use a Birth Date column (YYYY-MM-DD) to avoid this.
              </p>
            </div>
          )}

          {ambiguousAddressCount > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
              <p className="text-sm text-amber-800">
                <strong>{ambiguousAddressCount}</strong> row{ambiguousAddressCount !== 1 ? "s" : ""} had an address format the system {"couldn't"} parse confidently. The original text is in the Street name column — check and fix the Street # if needed.
              </p>
            </div>
          )}

          {autoParsedCount > 0 && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
              <p className="text-sm text-blue-800">
                <strong>{autoParsedCount}</strong> row{autoParsedCount !== 1 ? "s" : ""} had a combined Address column — split into Street # and Street name automatically. Spot-check before approving.
              </p>
            </div>
          )}

          {/* Grouped sections */}
          {missingRequiredCount > 0 && (
            <GroupSection
              title="Missing required fields"
              count={missingRequiredCount}
              tone="red"
              description="These rows are missing data needed to import. Fix them or skip."
              expanded={expanded.missing_required}
              onToggle={() => toggleGroup("missing_required")}
              rows={bucketed.missing_required}
              updateField={updateField}
              approveRow={approveRow}
              rejectRow={rejectRow}
              undoRow={undoRow}
            />
          )}

          {duplicateCount2 > 0 && (
            <GroupSection
              title="Possible duplicates"
              count={duplicateCount2}
              tone="orange"
              description="These rows may already exist in your voter list."
              expanded={expanded.duplicate}
              onToggle={() => toggleGroup("duplicate")}
              rows={bucketed.duplicate}
              updateField={updateField}
              approveRow={approveRow}
              rejectRow={rejectRow}
              undoRow={undoRow}
              bulkActions={
                <>
                  <Button variant="secondary" size="sm" onClick={() => approveAllInGroup("duplicate")}>
                    Approve all
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => rejectAllInGroup("duplicate")}>
                    Reject all
                  </Button>
                </>
              }
            />
          )}

          {incompleteCount > 0 && (
            <GroupSection
              title="Importable but incomplete"
              count={incompleteCount}
              tone="amber"
              description="These rows have all required fields but are missing optional data (email or address). They will be imported as-is unless you fix them first."
              expanded={expanded.incomplete}
              onToggle={() => toggleGroup("incomplete")}
              rows={bucketed.incomplete}
              updateField={updateField}
              approveRow={approveRow}
              rejectRow={rejectRow}
              undoRow={undoRow}
            />
          )}

          {readyCount2 > 0 && (
            <GroupSection
              title="Ready to import"
              count={readyCount2}
              tone="green"
              description="These rows are complete and ready to import."
              expanded={expanded.ready}
              onToggle={() => toggleGroup("ready")}
              rows={bucketed.ready}
              updateField={updateField}
              approveRow={approveRow}
              rejectRow={rejectRow}
              undoRow={undoRow}
            />
          )}

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
            {(missingRequiredCount > 0 || duplicateCount2 > 0) && (
              <p className="text-xs text-amber-600">
                {[
                  missingRequiredCount > 0 ? `${missingRequiredCount} row${missingRequiredCount !== 1 ? "s" : ""} need review` : "",
                  duplicateCount2 > 0 ? `${duplicateCount2} possible duplicate${duplicateCount2 !== 1 ? "s" : ""}` : "",
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
            {(result.voterIdUpdated > 0 || result.voterIdUnchanged > 0) ? (
              <p className="text-sm text-slate-500">
                {result.voterIdUpdated} matched and updated
                {" · "}
                {result.created} created new
                {result.voterIdUnchanged > 0 && ` · ${result.voterIdUnchanged} unchanged`}
                {result.skipped > 0 && ` · ${result.skipped} skipped`}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                {result.matched} matched existing record{result.matched !== 1 ? "s" : ""}
                {" · "}
                {result.created} new record{result.created !== 1 ? "s" : ""} created
                {result.skipped > 0 && ` · ${result.skipped} skipped`}
              </p>
            )}
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

          {result.duplicateCount > 0 && (
            <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-left flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <svg className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-sm text-amber-800">
                  <strong>{result.duplicateCount}</strong>{" "}
                  row{result.duplicateCount !== 1 ? "s" : ""} in your file pointed to the same person and{" "}
                  {result.duplicateCount !== 1 ? "were" : "was"} skipped. Check your file for duplicate entries.
                </p>
              </div>
            </div>
          )}

          {batchSession ? (
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={handleBackToBatches}>
                {batchSession.completedBatches.size + 1 < batchSession.batches.length
                  ? "Next batch"
                  : "Back to batches"}
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </div>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </div>
      )}

      <ExportFixModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        rows={reviewRows}
        originalHeaders={originalHeaders}
      />
    </Modal>
  );
}

// ── BatchSessionPanel ─────────────────────────────────────────────────────

interface BatchSessionPanelProps {
  session: {
    batches: FileBatchItem[];
    totalRows: number;
    completedBatches: Set<number>;
    listName: string;
    listImportType: string;
  };
  onStartBatch: (idx: number) => void;
  loadingBatchIndex: number | null;
  onClose: () => void;
}

function BatchSessionPanel({ session, onStartBatch, loadingBatchIndex, onClose }: BatchSessionPanelProps) {
  const { batches, completedBatches, totalRows } = session;
  const allDone = completedBatches.size === batches.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-4">
        <p className="text-sm font-medium text-slate-700 mb-1">
          File split into {batches.length} batches
        </p>
        <p className="text-xs text-slate-500">
          {totalRows.toLocaleString()} total rows — import each batch sequentially through the usual review flow.
        </p>
        {allDone && (
          <p className="text-xs text-emerald-600 font-medium mt-1">All batches imported.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {batches.map((batch, idx) => {
          const done = completedBatches.has(idx);
          const isThisLoading = loadingBatchIndex === idx;
          const anyLoading = loadingBatchIndex !== null;
          return (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">Batch {idx + 1}</p>
                <p className="text-xs text-slate-400">{batch.rowCount.toLocaleString()} rows</p>
              </div>
              {done ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Done
                </span>
              ) : (
                <Button
                  onClick={() => onStartBatch(idx)}
                  disabled={anyLoading}
                  loading={isThisLoading}
                >
                  Import
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {allDone ? "Close" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}

// ── GroupSection ───────────────────────────────────────────────────────────

const TONE_HEADER_BG: Record<"red" | "orange" | "amber" | "green", string> = {
  red:    "bg-red-50",
  orange: "bg-orange-50",
  amber:  "bg-amber-50",
  green:  "bg-emerald-50",
};
const TONE_LEFT_BORDER: Record<"red" | "orange" | "amber" | "green", string> = {
  red:    "border-l-red-300",
  orange: "border-l-orange-300",
  amber:  "border-l-amber-300",
  green:  "border-l-emerald-300",
};
const TONE_COUNT_CHIP: Record<"red" | "orange" | "amber" | "green", string> = {
  red:    "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  amber:  "bg-amber-100 text-amber-700",
  green:  "bg-emerald-100 text-emerald-700",
};

function GroupSection({
  title,
  count,
  tone,
  description,
  expanded,
  onToggle,
  rows,
  updateField,
  approveRow,
  rejectRow,
  undoRow,
  bulkActions,
}: {
  title: string;
  count: number;
  tone: "red" | "orange" | "amber" | "green";
  description: string;
  expanded: boolean;
  onToggle: () => void;
  rows: ReviewRow[];
  updateField: (rowId: number, field: keyof RowFields, value: string) => void;
  approveRow: (rowId: number) => void;
  rejectRow: (rowId: number) => void;
  undoRow: (rowId: number) => void;
  bulkActions?: ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 border-l-4 ${TONE_LEFT_BORDER[tone]} overflow-hidden`}>
      {/* Header row */}
      <div className={`flex items-stretch ${TONE_HEADER_BG[tone]}`}>
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-start gap-3 px-4 py-3 text-left transition-all hover:brightness-95"
        >
          <svg
            className={`h-4 w-4 flex-shrink-0 mt-0.5 transition-transform text-slate-500 ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">{title}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${TONE_COUNT_CHIP[tone]}`}>
                {count}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
        </button>
        {bulkActions && (
          <div className="flex items-center gap-1 px-3 flex-shrink-0">
            {bulkActions}
          </div>
        )}
      </div>

      {/* Table when expanded */}
      {expanded && (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 text-left border-b border-slate-100">
                <th className="px-3 py-2.5 text-xs font-medium text-slate-400 w-8">#</th>
                <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide sticky left-8 min-w-[88px] bg-slate-50 z-10">
                  Status
                </th>
                <th className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide sticky left-[120px] min-w-[140px] bg-slate-50 z-10">
                  Actions
                </th>
                {[...BASE_COLUMNS, ...EXTRA_COLUMNS].map((col) => (
                  <th key={col} className="px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {FIELD_LABELS[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row) => (
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
      )}
    </div>
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
  const bucket       = classifyRow(row);
  const isDuplicate  = row.status === "duplicate";
  const isEditable   = row.status === "flagged" || row.status === "approved";
  const isRejected   = row.status === "rejected";
  const isApproved   = row.status === "approved";
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

  // Opaque bg for sticky cells so scrolling content doesn't show through
  const stickyBg = isRejected
    ? "bg-slate-50"
    : isDuplicate
    ? "bg-orange-50"
    : row.status === "flagged"
    ? "bg-amber-50"
    : isApproved
    ? "bg-blue-50"
    : "bg-white";

  return (
    <tr className={rowBg}>
      <td className="px-3 py-2 text-xs text-slate-400">{row.originalRowNum}</td>

      {/* Status — sticky */}
      <td className={`px-3 py-2 sticky left-8 min-w-[88px] z-10 ${stickyBg}`}>
        <div className="flex flex-col gap-0.5">
          {isRejected ? (
            <StatusBadge label="Rejected"   color="slate"  />
          ) : isApproved ? (
            <StatusBadge label="Approved"   color="green"  />
          ) : bucket === "ready" ? (
            <StatusBadge label="Ready"      color="green"  />
          ) : bucket === "duplicate" ? (
            <StatusBadge label="Duplicate"  color="orange" />
          ) : bucket === "incomplete" ? (
            <StatusBadge label="Incomplete" color="amber"  />
          ) : (
            <StatusBadge label="Review"     color="red"    />
          )}
          {(bucket === "incomplete" || bucket === "missing_required") && !isRejected && (
            <span className="text-[11px] text-slate-500 leading-tight whitespace-normal">
              Missing: {listMissingFields(row).join(", ")}
            </span>
          )}
        </div>
      </td>

      {/* Actions — sticky */}
      <td className={`px-3 py-2 whitespace-nowrap sticky left-[120px] min-w-[140px] z-10 ${stickyBg}`}>
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
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-orange-600 leading-tight max-w-[140px] truncate" title={`Possible duplicate of ${row.duplicateOf}`}>
              of {row.duplicateOf}
            </span>
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

      {/* Data cells */}
      {ALL_COLUMNS.map((field) => {
        const isMandatory = MANDATORY_FIELDS.includes(field as typeof MANDATORY_FIELDS[number]);
        const isMissing = isMandatory && !row.fields[field].trim();
        const showAmbiguityBadge = field === "streetName" && !!row.addressAmbiguous;

        return (
          <td key={field} className="px-3 py-2">
            {isEditable ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={row.fields[field]}
                  onChange={(e) => onFieldChange(field, e.target.value)}
                  placeholder={FIELD_LABELS[field]}
                  className={[
                    "flex-1 min-w-0 text-xs px-2 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-brand-400",
                    isMissing
                      ? "border-amber-300 bg-amber-50 placeholder:text-amber-400"
                      : "border-slate-200 bg-white",
                  ].join(" ")}
                />
                {showAmbiguityBadge && (
                  <span
                    title="Address format couldn't be parsed confidently — verify Street # is correct"
                    className="inline-flex items-center flex-shrink-0 text-[10px] font-bold text-amber-600 bg-amber-100 px-1 py-0.5 rounded"
                  >
                    ?
                  </span>
                )}
              </div>
            ) : (
              <span className={["text-xs", isRejected ? "line-through text-slate-400" : "text-slate-700"].join(" ")}>
                {row.fields[field] || <span className="text-slate-300">—</span>}
                {showAmbiguityBadge && (
                  <span
                    title="Address format couldn't be parsed confidently — verify Street # is correct"
                    className="inline-flex items-center ml-1 text-[10px] font-bold text-amber-600 bg-amber-100 px-1 py-0.5 rounded"
                  >
                    ?
                  </span>
                )}
              </span>
            )}
          </td>
        );
      })}
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

function StatusBadge({ label, color }: { label: string; color: "green" | "amber" | "orange" | "blue" | "slate" | "red" }) {
  const styles = {
    green:  "bg-emerald-50 text-emerald-700",
    amber:  "bg-amber-50 text-amber-700",
    orange: "bg-orange-50 text-orange-700",
    blue:   "bg-blue-50 text-blue-700",
    slate:  "bg-slate-100 text-slate-500",
    red:    "bg-red-50 text-red-700",
  };
  return (
    <span className={["inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", styles[color]].join(" ")}>
      {label}
    </span>
  );
}

// ── TagReviewStep ──────────────────────────────────────────────────────────

function TagReviewStep({
  tagDecisions,
  existingTagsByLower,
  onDecisionChange,
  onBulkCreate,
  onBulkSkip,
  onContinue,
  onBack,
}: {
  tagDecisions: Record<string, TagDecision>;
  existingTagsByLower: Map<string, { id: string; name: string }>;
  onDecisionChange: (lower: string, decision: TagDecision) => void;
  onBulkCreate: () => void;
  onBulkSkip: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const unknownLowers = Object.keys(tagDecisions);
  const hasPending = unknownLowers.some((k) => tagDecisions[k].status === "pending");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
        <p className="text-sm text-blue-800">
          <strong>{unknownLowers.length}</strong> tag{unknownLowers.length !== 1 ? "s" : ""} in your file {"don't"} exist in this campaign yet. Choose what to do with each one.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 mr-1">Bulk:</span>
        <button
          type="button"
          onClick={onBulkCreate}
          className="text-xs px-3 py-1 rounded-lg font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
        >
          Create all
        </button>
        <button
          type="button"
          onClick={onBulkSkip}
          className="text-xs px-3 py-1 rounded-lg font-medium bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
        >
          Skip all
        </button>
      </div>

      <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
        {unknownLowers.map((lower) => {
          const decision = tagDecisions[lower];
          return (
            <TagDecisionRow
              key={lower}
              lower={lower}
              decision={decision}
              existingTagsByLower={existingTagsByLower}
              onChange={(d) => onDecisionChange(lower, d)}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button variant="secondary" onClick={onBack}>Back</Button>
        <div className="flex-1" />
        {hasPending && (
          <p className="text-xs text-amber-600">Resolve all tags to continue.</p>
        )}
        <Button onClick={onContinue} disabled={hasPending}>
          Continue to review
        </Button>
      </div>
    </div>
  );
}

function TagDecisionRow({
  lower,
  decision,
  existingTagsByLower,
  onChange,
}: {
  lower: string;
  decision: TagDecision;
  existingTagsByLower: Map<string, { id: string; name: string }>;
  onChange: (d: TagDecision) => void;
}) {
  function handleBlur(value: string) {
    const trimmed = value.trim();
    const match = existingTagsByLower.get(trimmed.toLowerCase());
    if (match) {
      onChange({ status: "use", edited: trimmed, resolvedTagId: match.id });
    } else {
      onChange({ ...decision, edited: trimmed, status: decision.status === "use" ? "pending" : decision.status });
    }
  }

  const statusLabel: Record<TagDecisionStatus, string> = {
    pending: "Undecided",
    create:  "Create new",
    skip:    "Skip",
    use:     "Use existing",
  };

  const statusColor: Record<TagDecisionStatus, string> = {
    pending: "text-amber-600",
    create:  "text-emerald-600",
    skip:    "text-slate-400",
    use:     "text-blue-600",
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white">
      <input
        type="text"
        value={decision.edited}
        onChange={(e) => onChange({ ...decision, edited: e.target.value })}
        onBlur={(e) => handleBlur(e.target.value)}
        disabled={decision.status === "skip"}
        className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:bg-slate-50 disabled:text-slate-400"
      />
      <span className={["text-xs font-medium w-20 text-right flex-shrink-0", statusColor[decision.status]].join(" ")}>
        {statusLabel[decision.status]}
      </span>
      <div className="flex gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => onChange({ ...decision, status: "create" })}
          className={[
            "text-xs px-2 py-1 rounded-lg font-medium transition-colors",
            decision.status === "create"
              ? "bg-emerald-500 text-white"
              : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
          ].join(" ")}
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...decision, status: "skip" })}
          className={[
            "text-xs px-2 py-1 rounded-lg font-medium transition-colors",
            decision.status === "skip"
              ? "bg-slate-400 text-white"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200",
          ].join(" ")}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

