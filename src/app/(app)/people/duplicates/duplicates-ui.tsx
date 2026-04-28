"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { findDuplicates, mergeDuplicateRecords } from "./actions";
import type { MatchField, DuplicateGroup, DupPerson, MergeFieldChoices } from "./actions";
import { SUPPORT_LEVEL_LABELS, LIST_SOURCE_LABELS } from "@/types";
import type { SupportLevel, ListSource } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const MATCH_FIELD_OPTIONS: { key: MatchField; label: string }[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "birthDate", label: "Birth date" },
  { key: "phoneHome", label: "Home phone" },
  { key: "phoneMobile", label: "Mobile phone" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address (street no. + name)" },
];

const MERGEABLE_FIELDS: { key: keyof MergeFieldChoices; label: string }[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phoneHome", label: "Home phone" },
  { key: "phoneMobile", label: "Mobile phone" },
  { key: "birthDate", label: "Birth date" },
  { key: "supportLevel", label: "Support level" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFieldDisplay(person: DupPerson, field: keyof MergeFieldChoices): string {
  switch (field) {
    case "firstName": return person.firstName;
    case "lastName": return person.lastName;
    case "email": return person.email ?? "";
    case "phoneHome": return person.phoneHome ?? "";
    case "phoneMobile": return person.phoneMobile ?? "";
    case "birthDate":
      return person.birthDate
        ? new Date(person.birthDate + "T00:00:00").toLocaleDateString("en-CA", {
            year: "numeric", month: "short", day: "numeric",
          })
        : "";
    case "supportLevel":
      return person.supportLevel
        ? (SUPPORT_LEVEL_LABELS[person.supportLevel as SupportLevel] ?? person.supportLevel)
        : "";
  }
}

function addressLine(person: DupPerson): string {
  if (!person.address) return "";
  const { streetNumber, streetName, unitNumber, city } = person.address;
  return `${streetNumber} ${streetName}${unitNumber ? ` #${unitNumber}` : ""}, ${city}`;
}

function defaultChoice(
  winnerVal: string,
  loserVal: string
): "winner" | "loser" {
  if (!winnerVal && loserVal) return "loser";
  return "winner";
}

// ── Main component ────────────────────────────────────────────────────────────

export function DuplicatesUi() {
  const [selectedFields, setSelectedFields] = useState<Set<MatchField>>(
    new Set(["firstName", "lastName", "address"])
  );
  const [isSearching, startSearch] = useTransition();
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dismissedIndices, setDismissedIndices] = useState<Set<number>>(new Set());
  const [mergeTarget, setMergeTarget] = useState<{
    group: DuplicateGroup;
    groupIndex: number;
  } | null>(null);

  function toggleField(field: MatchField) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function handleSearch() {
    setSearchError(null);
    setGroups(null);
    setDismissedIndices(new Set());

    const fields = [...selectedFields] as MatchField[];
    if (fields.length < 2) {
      setSearchError("Select at least 2 fields.");
      return;
    }

    startSearch(async () => {
      const result = await findDuplicates(fields);
      if (result.error) setSearchError(result.error);
      else setGroups(result.groups ?? []);
    });
  }

  function dismissGroup(idx: number) {
    setDismissedIndices((prev) => new Set([...prev, idx]));
  }

  const visibleCount = groups
    ? groups.filter((_, i) => !dismissedIndices.has(i)).length
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Field selector ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Find duplicates matching on:
        </h2>
        <div className="flex flex-wrap gap-x-5 gap-y-2.5 mb-4">
          {MATCH_FIELD_OPTIONS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedFields.has(key)}
                onChange={() => toggleField(key)}
                className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSearch}
            disabled={isSearching || selectedFields.size < 2}
            className="h-10 px-5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {isSearching ? "Searching…" : "Search for duplicates"}
          </button>
          {selectedFields.size < 2 && (
            <span className="text-xs text-slate-400">Select at least 2 fields</span>
          )}
        </div>
        {searchError && (
          <p className="text-sm text-red-500 mt-2">{searchError}</p>
        )}
      </div>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {groups !== null && (
        <div>
          <p className="text-sm text-slate-500 mb-4">
            {visibleCount === 0
              ? "No duplicates found with these matching rules."
              : `${visibleCount} duplicate group${visibleCount !== 1 ? "s" : ""} found`}
            {groups.length >= 100 && " (showing first 100)"}
          </p>

          <div className="flex flex-col gap-5">
            {groups.map((group, idx) => {
              if (dismissedIndices.has(idx)) return null;
              return (
                <GroupCard
                  key={idx}
                  group={group}
                  onMerge={() => setMergeTarget({ group, groupIndex: idx })}
                  onDismiss={() => dismissGroup(idx)}
                />
              );
            })}
          </div>

          {visibleCount === 0 && groups.length > 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">All groups reviewed.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Merge modal ─────────────────────────────────────────────────── */}
      {mergeTarget && (
        <MergeModal
          group={mergeTarget.group}
          onClose={() => setMergeTarget(null)}
          onMerged={() => {
            const idx = mergeTarget.groupIndex;
            setMergeTarget(null);
            dismissGroup(idx);
          }}
        />
      )}
    </div>
  );
}

// ── GroupCard ─────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onMerge,
  onDismiss,
}: {
  group: DuplicateGroup;
  onMerge: () => void;
  onDismiss: () => void;
}) {
  const { records, matchedFields } = group;

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm font-medium text-amber-800">
            {records.length} records match on:{" "}
            <span className="font-semibold">
              {matchedFields
                .map((f) => MATCH_FIELD_OPTIONS.find((o) => o.key === f)?.label ?? f)
                .join(", ")}
            </span>
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors flex-shrink-0"
        >
          Not duplicates
        </button>
      </div>

      {/* Records grid */}
      <div
        className={[
          "grid divide-y sm:divide-y-0 sm:divide-x divide-slate-100",
          records.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3",
        ].join(" ")}
      >
        {records.map((person, i) => (
          <PersonMiniCard
            key={person.id}
            person={person}
            label={i === 0 ? "Record A" : i === 1 ? "Record B" : `Record ${String.fromCharCode(65 + i)}`}
            matchedFields={matchedFields}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 flex-1">
          {records.length > 2
            ? `Showing ${records.length} matching records. Merge will combine the top two (by canvass count).`
            : "Review both records, then merge to keep the best data."}
        </p>
        <button
          onClick={onMerge}
          className="h-9 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors flex-shrink-0"
        >
          Merge these records
        </button>
      </div>
    </div>
  );
}

// ── PersonMiniCard ────────────────────────────────────────────────────────────

function PersonMiniCard({
  person,
  label,
  matchedFields,
}: {
  person: DupPerson;
  label: string;
  matchedFields: MatchField[];
}) {
  const addr = addressLine(person);

  function isMatched(field: MatchField) {
    return matchedFields.includes(field);
  }

  function fieldCls(field: MatchField) {
    return isMatched(field)
      ? "bg-amber-50 px-1.5 py-0.5 rounded-md ring-1 ring-amber-200"
      : "";
  }

  return (
    <div className="px-5 py-4">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{label}</p>

      <div className="mb-3">
        <Link
          href={`/people/${person.id}`}
          target="_blank"
          className="font-semibold text-slate-900 hover:text-brand-600 transition-colors text-sm leading-tight"
        >
          <span className={fieldCls("firstName")}>{person.firstName}</span>{" "}
          <span className={fieldCls("lastName")}>{person.lastName}</span>
        </Link>
        {person.userId && (
          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-100 text-violet-700">
            Team
          </span>
        )}
      </div>

      <dl className="flex flex-col gap-1.5 text-xs">
        {addr && (
          <InfoRow label="Address" highlighted={isMatched("address")}>
            {addr}
          </InfoRow>
        )}
        {person.phoneHome && (
          <InfoRow label="Phone" highlighted={isMatched("phoneHome")}>
            {person.phoneHome}
          </InfoRow>
        )}
        {person.phoneMobile && (
          <InfoRow label="Mobile" highlighted={isMatched("phoneMobile")}>
            {person.phoneMobile}
          </InfoRow>
        )}
        {person.email && (
          <InfoRow label="Email" highlighted={isMatched("email")}>
            {person.email}
          </InfoRow>
        )}
        {person.birthDate && (
          <InfoRow label="Birth date" highlighted={isMatched("birthDate")}>
            {new Date(person.birthDate + "T00:00:00").toLocaleDateString("en-CA", {
              year: "numeric", month: "short", day: "numeric",
            })}
          </InfoRow>
        )}
        {person.supportLevel && (
          <InfoRow label="Support">
            {SUPPORT_LEVEL_LABELS[person.supportLevel as SupportLevel] ?? person.supportLevel}
          </InfoRow>
        )}
        <InfoRow label="Source">
          {LIST_SOURCE_LABELS[person.listSource as ListSource] ?? person.listSource}
        </InfoRow>
        <InfoRow label="Canvassed">{person.canvassCount} responses</InfoRow>
        <InfoRow label="Added">
          {new Date(person.createdAt).toLocaleDateString("en-CA", {
            year: "numeric", month: "short", day: "numeric",
          })}
        </InfoRow>
      </dl>

      {person.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {person.tags.slice(0, 4).map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border"
              style={
                tag.color
                  ? { backgroundColor: tag.color + "18", color: tag.color, borderColor: tag.color + "40" }
                  : undefined
              }
            >
              {tag.name}
            </span>
          ))}
          {person.tags.length > 4 && (
            <span className="text-[10px] text-slate-400">+{person.tags.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  highlighted,
  children,
}: {
  label: string;
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-slate-400 flex-shrink-0 w-16">{label}</dt>
      <dd className={["text-slate-700 min-w-0 break-words", highlighted ? "font-medium text-amber-800" : ""].join(" ")}>
        {children}
      </dd>
    </div>
  );
}

// ── MergeModal ────────────────────────────────────────────────────────────────

function MergeModal({
  group,
  onClose,
  onMerged,
}: {
  group: DuplicateGroup;
  onClose: () => void;
  onMerged: () => void;
}) {
  // Default winner = record with most canvass responses; loser = second most
  const sorted = [...group.records].sort((a, b) => b.canvassCount - a.canvassCount);
  const [winnerId, setWinnerId] = useState(sorted[0].id);
  const [isMerging, startMerge] = useTransition();
  const [mergeError, setMergeError] = useState<string | null>(null);

  const winner = group.records.find((r) => r.id === winnerId) ?? sorted[0];
  const loser = sorted.find((r) => r.id !== winnerId) ?? sorted[1];

  // Field choices: for each mergeable field, "winner" or "loser"
  const [choices, setChoices] = useState<MergeFieldChoices>(() =>
    initChoices(winner, loser)
  );

  // Re-init choices when winner changes
  function handleSwap() {
    const newWinnerId = loser.id;
    setWinnerId(newWinnerId);
    const newWinner = group.records.find((r) => r.id === newWinnerId) ?? loser;
    const newLoser = group.records.find((r) => r.id !== newWinnerId) ?? winner;
    setChoices(initChoices(newWinner, newLoser));
  }

  function setChoice(field: keyof MergeFieldChoices, val: "winner" | "loser") {
    setChoices((prev) => ({ ...prev, [field]: val }));
  }

  function handleConfirm() {
    setMergeError(null);
    startMerge(async () => {
      const result = await mergeDuplicateRecords({
        winnerId: winner.id,
        loserId: loser.id,
        fieldChoices: choices,
      });
      if (result.error) {
        setMergeError(result.error);
      } else {
        onMerged();
      }
    });
  }

  const totalCanvass = winner.canvassCount + loser.canvassCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-900">Merge duplicate records</h2>
          <button
            onClick={onClose}
            disabled={isMerging}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* Primary record selector */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className={[
              "rounded-2xl border-2 p-4 transition-colors",
              "border-brand-400 bg-brand-50",
            ].join(" ")}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">Primary (kept)</p>
              </div>
              <p className="font-semibold text-slate-900">{winner.firstName} {winner.lastName}</p>
              <p className="text-xs text-slate-500 mt-0.5">{addressLine(winner) || "No address"}</p>
              <p className="text-xs text-slate-400 mt-1">{winner.canvassCount} canvass responses</p>
              {winner.userId && (
                <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-100 text-violet-700">
                  Team
                </span>
              )}
            </div>
            <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Secondary (absorbed)</p>
                <button
                  onClick={handleSwap}
                  disabled={isMerging}
                  className="text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors"
                >
                  Make primary
                </button>
              </div>
              <p className="font-semibold text-slate-700">{loser.firstName} {loser.lastName}</p>
              <p className="text-xs text-slate-500 mt-0.5">{addressLine(loser) || "No address"}</p>
              <p className="text-xs text-slate-400 mt-1">{loser.canvassCount} canvass responses</p>
              {loser.userId && (
                <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-100 text-violet-700">
                  Team
                </span>
              )}
            </div>
          </div>

          {/* Canvass summary */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 mb-5">
            <p className="text-sm text-emerald-800">
              <span className="font-semibold">{totalCanvass} total canvass responses</span> will be combined
              ({winner.canvassCount} + {loser.canvassCount}).
            </p>
          </div>

          {/* Field choices */}
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Choose which values to keep
          </h3>
          <div className="flex flex-col gap-2">
            {MERGEABLE_FIELDS.map(({ key, label }) => {
              const wVal = formatFieldDisplay(winner, key);
              const lVal = formatFieldDisplay(loser, key);
              const same = wVal === lVal;
              const choice = choices[key] ?? "winner";

              if (same && !wVal) return null; // both empty, nothing to show

              return (
                <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">{label}</p>
                  {same ? (
                    <p className="text-sm text-slate-700">{wVal} <span className="text-slate-400 text-xs ml-1">(same in both records)</span></p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <label className={[
                        "flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                        choice === "winner"
                          ? "border-brand-300 bg-brand-50"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      ].join(" ")}>
                        <input
                          type="radio"
                          name={key}
                          checked={choice === "winner"}
                          onChange={() => setChoice(key, "winner")}
                          className="mt-0.5 text-brand-500 focus:ring-brand-500"
                        />
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 mb-0.5">Primary</p>
                          <p className="text-sm text-slate-800 break-words">{wVal || <span className="text-slate-300 italic">empty</span>}</p>
                        </div>
                      </label>
                      <label className={[
                        "flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                        choice === "loser"
                          ? "border-brand-300 bg-brand-50"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      ].join(" ")}>
                        <input
                          type="radio"
                          name={key}
                          checked={choice === "loser"}
                          onChange={() => setChoice(key, "loser")}
                          className="mt-0.5 text-brand-500 focus:ring-brand-500"
                        />
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 mb-0.5">Secondary</p>
                          <p className="text-sm text-slate-800 break-words">{lVal || <span className="text-slate-300 italic">empty</span>}</p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Address note */}
          <p className="text-xs text-slate-400 mt-3">
            Address: the primary record&apos;s address is kept. Update it manually if needed.
          </p>

          {mergeError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mt-4">
              {mergeError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isMerging}
            className="h-10 px-5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isMerging}
            className="h-10 px-5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {isMerging ? "Merging…" : "Confirm merge"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers for MergeModal ────────────────────────────────────────────────────

function initChoices(winner: DupPerson, loser: DupPerson): MergeFieldChoices {
  const init: MergeFieldChoices = {};
  for (const { key } of MERGEABLE_FIELDS) {
    const wVal = formatFieldDisplay(winner, key);
    const lVal = formatFieldDisplay(loser, key);
    if (wVal !== lVal) {
      init[key] = defaultChoice(wVal, lVal);
    }
  }
  return init;
}
