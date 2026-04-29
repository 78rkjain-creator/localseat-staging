"use client";

import { useState, useMemo, useTransition, useRef } from "react";
import Link from "next/link";
import {
  parseTeamCsvToReviewRows,
  parseXlsxToTeamReviewRows,
  classifyTeamRow,
  listMissingTeamFields,
  parseTagList,
} from "@/lib/team-csv-import";
import type { TeamReviewRow, TeamRowFields } from "@/lib/team-csv-import";
import {
  checkExistingMembers,
  commitTeamImport,
} from "./actions";
import type { TagPlan } from "./actions";

// ── Local types ────────────────────────────────────────────────────────────────

// Re-export from actions so import-client can use it without "use server" issues
type _TagDecisionStatus = "pending" | "create" | "skip" | "use";

interface TagDecision {
  status: _TagDecisionStatus;
  edited: string;
  resolvedTagId?: string;
}

type Step = "upload" | "tagReview" | "review" | "done";

interface CommitResult {
  created: number;
  linked: number;
  skipped: number;
  failed: { row: number; reason: string }[];
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface TeamImportClientProps {
  validRoles: string[];
  existingTags: { id: string; name: string }[];
  requesterRole: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TeamImportClient({
  existingTags,
}: TeamImportClientProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [reviewRows, setReviewRows] = useState<TeamReviewRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [skipVerification, setSkipVerification] = useState(false);
  const [sendWelcome, setSendWelcome] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [isCommitting, startCommit] = useTransition();
  const [expanded, setExpanded] = useState({
    missing: false,
    dedup: false,
    incomplete: false,
    ready: false,
  });

  // Tag review state
  const [tagDecisions, setTagDecisions] = useState<Record<string, TagDecision>>({});
  const [allTagNamesFromImport, setAllTagNamesFromImport] = useState<string[]>([]);

  // Build existing tags map once
  const existingTagsByLower = useMemo(
    () => new Map(existingTags.map((t) => [t.name.toLowerCase(), t])),
    [existingTags],
  );

  // ── Bucketing ──────────────────────────────────────────────────────────────

  const bucketed = useMemo(() => {
    const alreadyOnTeam: TeamReviewRow[] = [];
    const linkedExisting: TeamReviewRow[] = [];
    const missingRequired: TeamReviewRow[] = [];
    const incomplete: TeamReviewRow[] = [];
    const ready: TeamReviewRow[] = [];

    for (const r of reviewRows) {
      if (r.status === "skipped_already_member") { alreadyOnTeam.push(r); continue; }
      if (r.status === "linked_existing_user")   { linkedExisting.push(r); continue; }
      const cls = classifyTeamRow(r);
      if (cls === "missing_required") { missingRequired.push(r); continue; }
      if (cls === "incomplete")       { incomplete.push(r); continue; }
      ready.push(r);
    }

    return { alreadyOnTeam, linkedExisting, missingRequired, incomplete, ready };
  }, [reviewRows]);

  const showDedupGroup = bucketed.alreadyOnTeam.length > 0 || bucketed.linkedExisting.length > 0;
  const importCount = bucketed.ready.length + bucketed.incomplete.length + bucketed.linkedExisting.length;

  const autoParsedCount = reviewRows.filter((r) => r.addressAutoParsed && !r.addressAmbiguous).length;
  const ambiguousCount  = reviewRows.filter((r) => r.addressAmbiguous).length;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function resetToUpload() {
    if (fileRef.current) fileRef.current.value = "";
    setStep("upload");
    setReviewRows([]);
    setFileError(null);
    setCommitError(null);
    setCommitResult(null);
    setTagDecisions({});
    setAllTagNamesFromImport([]);
    setExpanded({ missing: false, dedup: false, incomplete: false, ready: false });
    setSkipVerification(false);
    setSendWelcome(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileError(null);
    setReviewRows([]);
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

    setIsProcessing(true);
    try {
      let rows: TeamReviewRow[];
      let err: string | null;

      if (ext === "xlsx") {
        ({ rows, fileError: err } = await parseXlsxToTeamReviewRows(file));
      } else {
        const text = await file.text();
        ({ rows, fileError: err } = parseTeamCsvToReviewRows(text));
      }

      if (err) { setFileError(err); return; }
      if (rows.length > 1000) {
        setFileError("File contains more than 1,000 rows. Split and import in batches.");
        return;
      }

      // Server-side dedup check
      const emails = rows.map((r) => r.fields.email).filter(Boolean);
      const { skippedEmails, linkedExistingEmails } = await checkExistingMembers(emails);
      const skippedSet = new Set(skippedEmails.map((e) => e.toLowerCase()));
      const linkedSet  = new Set(linkedExistingEmails.map((e) => e.toLowerCase()));

      const markedRows = rows.map((row) => {
        const emailLower = row.fields.email.toLowerCase();
        if (skippedSet.has(emailLower)) return { ...row, status: "skipped_already_member" as const };
        if (linkedSet.has(emailLower))  return { ...row, status: "linked_existing_user" as const };
        return row;
      });

      setReviewRows(markedRows);

      // Tag review check
      const seenLower = new Set<string>();
      const allTagNames: string[] = [];
      for (const r of markedRows) {
        for (const name of parseTagList(r.fields.tags)) {
          const lower = name.toLowerCase();
          if (!seenLower.has(lower)) { seenLower.add(lower); allTagNames.push(name); }
        }
      }
      setAllTagNamesFromImport(allTagNames);

      const unknown = allTagNames.filter((n) => !existingTagsByLower.has(n.toLowerCase()));
      if (unknown.length > 0) {
        const initial: Record<string, TagDecision> = {};
        for (const name of unknown) {
          initial[name.toLowerCase()] = { status: "pending", edited: name };
        }
        setTagDecisions(initial);
        setStep("tagReview");
        return;
      }

      setStep("review");
    } catch {
      setFileError("Something went wrong while processing the file.");
    } finally {
      setIsProcessing(false);
    }
  }

  function rejectRow(rowId: number) {
    setReviewRows((prev) =>
      prev.map((r) => r.id !== rowId ? r : { ...r, status: "rejected" as const }),
    );
  }

  function undoRow(rowId: number) {
    setReviewRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const cls = classifyTeamRow(r);
        const status = cls === "missing_required" ? "missing_required" as const
          : cls === "incomplete" ? "incomplete" as const
          : "ready" as const;
        return { ...r, status };
      }),
    );
  }

  function handleSkipVerificationToggle(val: boolean) {
    setSkipVerification(val);
    setSendWelcome(val);
  }

  function handleCommit() {
    setCommitError(null);
    if (importCount === 0) {
      setCommitError("No rows to import.");
      return;
    }

    // Build tag plan
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

    startCommit(async () => {
      const res = await commitTeamImport({
        rows: reviewRows,
        skipVerification,
        sendWelcomeEmail: sendWelcome,
        tagPlan,
      });

      if (res.errors) {
        setCommitError(res.errors);
        return;
      }

      setCommitResult({ created: res.created, linked: res.linked, skipped: res.skipped, failed: res.failed });
      setStep("done");
    });
  }

  // ── Render: upload step ────────────────────────────────────────────────────

  if (step === "upload") {
    return (
      <div className="flex flex-col gap-5 max-w-lg">
        <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-sm font-medium text-slate-700">XLSX / CSV format</p>
            <a
              href="/api/team/import-template"
              download
              className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1 flex-shrink-0"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download template
            </a>
          </div>
          <p className="text-xs text-slate-500 font-mono leading-relaxed break-all">
            FirstName, LastName, Email, Role, PhoneHome, PhoneMobile, StreetNumber, StreetName, UnitNumber, City, Province, PostalCode, Tags
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Required: FirstName, LastName, Email, Role, and at least one phone. Max 1,000 rows.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Select file</label>
          {isProcessing ? (
            <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
              <svg className="animate-spin h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing…
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
      </div>
    );
  }

  // ── Render: tag review step ────────────────────────────────────────────────

  if (step === "tagReview") {
    const unknownLowers = Object.keys(tagDecisions);
    const hasPending = unknownLowers.some((k) => tagDecisions[k].status === "pending");

    return (
      <div className="flex flex-col gap-4 max-w-lg">
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
          <p className="text-sm text-blue-800">
            <strong>{unknownLowers.length}</strong> tag{unknownLowers.length !== 1 ? "s" : ""} in your file{" "}
            don&apos;t exist in this campaign yet. Choose what to do with each one.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 mr-1">Bulk:</span>
          <button
            type="button"
            onClick={() =>
              setTagDecisions((prev) => {
                const next = { ...prev };
                for (const k of Object.keys(next)) {
                  if (next[k].status === "pending") next[k] = { ...next[k], status: "create" };
                }
                return next;
              })
            }
            className="text-xs px-3 py-1 rounded-lg font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
          >
            Create all
          </button>
          <button
            type="button"
            onClick={() =>
              setTagDecisions((prev) => {
                const next = { ...prev };
                for (const k of Object.keys(next)) {
                  if (next[k].status === "pending") next[k] = { ...next[k], status: "skip" };
                }
                return next;
              })
            }
            className="text-xs px-3 py-1 rounded-lg font-medium bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Skip all
          </button>
        </div>

        <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          {unknownLowers.map((lower) => (
            <TagDecisionRow
              key={lower}
              lower={lower}
              decision={tagDecisions[lower]}
              existingTagsByLower={existingTagsByLower}
              onChange={(d) => setTagDecisions((prev) => ({ ...prev, [lower]: d }))}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setStep("upload");
              setReviewRows([]);
              setTagDecisions({});
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Back
          </button>
          <div className="flex-1" />
          {hasPending && <p className="text-xs text-amber-600">Resolve all tags to continue.</p>}
          <button
            type="button"
            onClick={() => setStep("review")}
            disabled={hasPending}
            className="h-9 px-4 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue to review
          </button>
        </div>
      </div>
    );
  }

  // ── Render: review step ────────────────────────────────────────────────────

  if (step === "review") {
    return (
      <div className="flex flex-col gap-4">
        {/* Settings bar */}
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 space-y-3">
          <p className="text-sm font-semibold text-slate-800">Settings for this import</p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={skipVerification}
              onChange={(e) => handleSkipVerificationToggle(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-orange-500"
            />
            <div>
              <p className="text-sm font-medium text-slate-700">Skip email verification</p>
              <p className="text-xs text-slate-500">
                Members can sign in immediately with a temp password instead of confirming via email.
              </p>
            </div>
          </label>
          <label className={["flex items-start gap-3", skipVerification ? "cursor-pointer" : "opacity-40 cursor-not-allowed"].join(" ")}>
            <input
              type="checkbox"
              checked={sendWelcome}
              onChange={(e) => { if (skipVerification) setSendWelcome(e.target.checked); }}
              disabled={!skipVerification}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-orange-500"
            />
            <div>
              <p className="text-sm font-medium text-slate-700">Send welcome email</p>
              <p className="text-xs text-slate-500">
                Email each new member their temp password and login link.
              </p>
            </div>
          </label>
        </div>

        {/* Summary pills */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {bucketed.ready.length > 0 && <SummaryPill count={bucketed.ready.length} label="ready" color="green" />}
          {bucketed.incomplete.length > 0 && <SummaryPill count={bucketed.incomplete.length} label="incomplete" color="amber" />}
          {bucketed.linkedExisting.length > 0 && <SummaryPill count={bucketed.linkedExisting.length} label="link existing" color="blue" />}
          {bucketed.alreadyOnTeam.length > 0 && <SummaryPill count={bucketed.alreadyOnTeam.length} label="already on team" color="slate" />}
          {bucketed.missingRequired.length > 0 && <SummaryPill count={bucketed.missingRequired.length} label="missing required" color="red" />}
        </div>

        {/* Address parse banners */}
        {ambiguousCount > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
            <p className="text-sm text-amber-800">
              <strong>{ambiguousCount}</strong> row{ambiguousCount !== 1 ? "s" : ""} had an address format the system couldn&apos;t parse confidently.
              Check and correct the address before importing.
            </p>
          </div>
        )}
        {autoParsedCount > 0 && (
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
            <p className="text-sm text-blue-800">
              <strong>{autoParsedCount}</strong> row{autoParsedCount !== 1 ? "s" : ""} had a combined Address column — split automatically. Spot-check before importing.
            </p>
          </div>
        )}

        {/* Group: missing required */}
        {bucketed.missingRequired.length > 0 && (
          <TeamGroupSection
            title="Missing required fields"
            count={bucketed.missingRequired.length}
            tone="red"
            description="These rows are missing required data and cannot be imported. Skip them or fix the CSV."
            expanded={expanded.missing}
            onToggle={() => setExpanded((p) => ({ ...p, missing: !p.missing }))}
            rows={bucketed.missingRequired}
            onReject={rejectRow}
            onUndo={undoRow}
          />
        )}

        {/* Group: dedup (already on team + linked) */}
        {showDedupGroup && (
          <div className="rounded-xl border border-slate-200 border-l-4 border-l-blue-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded((p) => ({ ...p, dedup: !p.dedup }))}
              className="w-full flex items-start gap-3 px-4 py-3 text-left bg-blue-50 hover:brightness-95 transition-all"
            >
              <svg
                className={`h-4 w-4 flex-shrink-0 mt-0.5 transition-transform text-slate-500 ${expanded.dedup ? "rotate-90" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">Already in system</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                    {bucketed.alreadyOnTeam.length + bucketed.linkedExisting.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Auto-resolved — no action needed. Already-on-team rows will be skipped; linked rows will be added to this campaign.
                </p>
              </div>
            </button>

            {expanded.dedup && (
              <div className="border-t border-slate-100">
                {bucketed.alreadyOnTeam.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Already on team (will skip)</p>
                    <div className="flex flex-col gap-1">
                      {bucketed.alreadyOnTeam.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 text-sm">
                          <span className="text-slate-700">{r.fields.firstName} {r.fields.lastName}</span>
                          <span className="text-slate-400 text-xs">{r.fields.email}</span>
                          <span className="ml-auto text-xs text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">Skip</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {bucketed.linkedExisting.length > 0 && (
                  <div className="px-4 py-3 border-t border-slate-50">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Existing user (will link to campaign)</p>
                    <div className="flex flex-col gap-1">
                      {bucketed.linkedExisting.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 text-sm">
                          <span className="text-slate-700">{r.fields.firstName} {r.fields.lastName}</span>
                          <span className="text-slate-400 text-xs">{r.fields.email}</span>
                          <span className="ml-auto text-xs text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">Link</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Group: incomplete */}
        {bucketed.incomplete.length > 0 && (
          <TeamGroupSection
            title="Importable but incomplete"
            count={bucketed.incomplete.length}
            tone="amber"
            description="These rows have all required fields but no address. They will be imported as-is."
            expanded={expanded.incomplete}
            onToggle={() => setExpanded((p) => ({ ...p, incomplete: !p.incomplete }))}
            rows={bucketed.incomplete}
            onReject={rejectRow}
            onUndo={undoRow}
          />
        )}

        {/* Group: ready */}
        {bucketed.ready.length > 0 && (
          <TeamGroupSection
            title="Ready to import"
            count={bucketed.ready.length}
            tone="green"
            description="These rows are complete and ready to import."
            expanded={expanded.ready}
            onToggle={() => setExpanded((p) => ({ ...p, ready: !p.ready }))}
            rows={bucketed.ready}
            onReject={rejectRow}
            onUndo={undoRow}
          />
        )}

        {commitError && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-sm text-red-600">{commitError}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setStep("upload");
              setReviewRows([]);
              if (fileRef.current) fileRef.current.value = "";
            }}
            disabled={isCommitting}
            className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Back
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleCommit}
            disabled={importCount === 0 || isCommitting}
            className="h-9 px-5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
          >
            {isCommitting && (
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Import {importCount} {importCount === 1 ? "member" : "members"}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: done step ──────────────────────────────────────────────────────

  if (step === "done" && commitResult) {
    return (
      <div className="max-w-lg">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-900">Import complete</p>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            {commitResult.created > 0 && (
              <div className="flex items-center gap-2 text-slate-700">
                <span className="text-emerald-600 font-bold">✓</span>
                <span><strong>{commitResult.created}</strong> member{commitResult.created !== 1 ? "s" : ""} created</span>
              </div>
            )}
            {commitResult.linked > 0 && (
              <div className="flex items-center gap-2 text-slate-700">
                <span className="text-blue-600 font-bold">↗</span>
                <span><strong>{commitResult.linked}</strong> linked to existing {commitResult.linked !== 1 ? "users" : "user"}</span>
              </div>
            )}
            {commitResult.skipped > 0 && (
              <div className="flex items-center gap-2 text-slate-500">
                <span className="font-bold">⊘</span>
                <span><strong>{commitResult.skipped}</strong> skipped (already on team)</span>
              </div>
            )}
            {commitResult.failed.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-red-600">
                  <span className="font-bold">✗</span>
                  <span><strong>{commitResult.failed.length}</strong> failed</span>
                </div>
                <div className="ml-5 flex flex-col gap-0.5">
                  {commitResult.failed.map((f) => (
                    <p key={f.row} className="text-xs text-red-500">
                      Row {f.row}: {f.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Link
              href="/team"
              className="h-9 px-4 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors inline-flex items-center"
            >
              Back to team
            </Link>
            <button
              type="button"
              onClick={resetToUpload}
              className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Import another file
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── TeamGroupSection ───────────────────────────────────────────────────────────

const TONE_HEADER_BG = {
  red:   "bg-red-50",
  amber: "bg-amber-50",
  green: "bg-emerald-50",
} as const;

const TONE_LEFT_BORDER = {
  red:   "border-l-red-300",
  amber: "border-l-amber-300",
  green: "border-l-emerald-300",
} as const;

const TONE_COUNT_CHIP = {
  red:   "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  green: "bg-emerald-100 text-emerald-700",
} as const;

type Tone = keyof typeof TONE_HEADER_BG;

function TeamGroupSection({
  title,
  count,
  tone,
  description,
  expanded,
  onToggle,
  rows,
  onReject,
  onUndo,
}: {
  title: string;
  count: number;
  tone: Tone;
  description: string;
  expanded: boolean;
  onToggle: () => void;
  rows: TeamReviewRow[];
  onReject: (id: number) => void;
  onUndo: (id: number) => void;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 border-l-4 ${TONE_LEFT_BORDER[tone]} overflow-hidden`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-start gap-3 px-4 py-3 text-left ${TONE_HEADER_BG[tone]} hover:brightness-95 transition-all`}
      >
        <svg
          className={`h-4 w-4 flex-shrink-0 mt-0.5 transition-transform text-slate-500 ${expanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{title}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${TONE_COUNT_CHIP[tone]}`}>
              {count}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-left">
                <th className="px-3 py-2 text-xs font-medium text-slate-400 w-8">#</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Name</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Email</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Role</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Phone</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Issues</th>
                <th className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row) => (
                <TeamReviewRowComponent
                  key={row.id}
                  row={row}
                  onReject={() => onReject(row.id)}
                  onUndo={() => onUndo(row.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── TeamReviewRowComponent ─────────────────────────────────────────────────────

function TeamReviewRowComponent({
  row,
  onReject,
  onUndo,
}: {
  row: TeamReviewRow;
  onReject: () => void;
  onUndo: () => void;
}) {
  const isRejected = row.status === "rejected";
  const missing = listMissingTeamFields(row);
  const hasAddress = Boolean(row.fields.streetNumber && row.fields.streetName);

  const rowBg = isRejected ? "bg-slate-50 opacity-50" : "bg-white";

  return (
    <tr className={rowBg}>
      <td className="px-3 py-2 text-xs text-slate-400">{row.originalRowNum}</td>

      <td className="px-3 py-2">
        <span className={["text-sm", isRejected ? "line-through text-slate-400" : "text-slate-700"].join(" ")}>
          {row.fields.firstName} {row.fields.lastName}
        </span>
      </td>

      <td className="px-3 py-2">
        <span className={["text-xs", isRejected ? "line-through text-slate-400" : "text-slate-600"].join(" ")}>
          {row.fields.email || <span className="text-slate-300">—</span>}
        </span>
      </td>

      <td className="px-3 py-2">
        <span className={["text-xs", isRejected ? "line-through text-slate-400" : "text-slate-600"].join(" ")}>
          {row.fields.role || <span className="text-slate-300">—</span>}
        </span>
      </td>

      <td className="px-3 py-2">
        <span className="text-xs text-slate-500">
          {row.fields.phoneHome || row.fields.phoneMobile || <span className="text-slate-300">—</span>}
        </span>
      </td>

      <td className="px-3 py-2">
        {missing.length > 0 && !isRejected ? (
          <span className="text-xs text-red-500">Missing: {missing.join(", ")}</span>
        ) : !hasAddress && !isRejected ? (
          <span className="text-xs text-amber-500">No address</span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>

      <td className="px-3 py-2">
        {isRejected ? (
          <button
            onClick={onUndo}
            className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
          >
            Undo
          </button>
        ) : (
          <button
            onClick={onReject}
            className="text-xs px-2 py-1 rounded-lg font-medium bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"
          >
            Skip
          </button>
        )}
      </td>
    </tr>
  );
}

// ── SummaryPill ────────────────────────────────────────────────────────────────

function SummaryPill({
  count, label, color,
}: { count: number; label: string; color: "green" | "amber" | "blue" | "slate" | "red" }) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue:  "bg-blue-50 text-blue-700 border-blue-200",
    slate: "bg-slate-100 text-slate-500 border-slate-200",
    red:   "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={["inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border", styles[color]].join(" ")}>
      <span className="font-bold">{count}</span> {label}
    </span>
  );
}

// ── TagDecisionRow ─────────────────────────────────────────────────────────────

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

  const statusLabel: Record<_TagDecisionStatus, string> = {
    pending: "Undecided",
    create:  "Create new",
    skip:    "Skip",
    use:     "Use existing",
  };
  const statusColor: Record<_TagDecisionStatus, string> = {
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
          className={["text-xs px-2 py-1 rounded-lg font-medium transition-colors", decision.status === "create" ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"].join(" ")}
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...decision, status: "skip" })}
          className={["text-xs px-2 py-1 rounded-lg font-medium transition-colors", decision.status === "skip" ? "bg-slate-400 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"].join(" ")}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
