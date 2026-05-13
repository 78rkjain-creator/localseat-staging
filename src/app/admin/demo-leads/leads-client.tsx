"use client";

import { useState, useTransition, useMemo } from "react";
import type { DemoLead, LeadFilters } from "./actions";
import { markAsEmailed, unmarkAsEmailed, exportDemoLeadsCSV, deleteDemoLeads } from "./actions";

const OFFICE_OPTIONS = [
  "Ward Councillor",
  "Mayor",
  "School Board Trustee",
  "Other",
];

interface Props {
  initialLeads: DemoLead[];
}

export function LeadsClient({ initialLeads }: Props) {
  const [leads, setLeads]            = useState<DemoLead[]>(initialLeads);
  const [search, setSearch]          = useState("");
  const [emailed, setEmailed]        = useState<LeadFilters["emailed"]>("all");
  const [officeType, setOfficeType]  = useState("");
  const [dateFrom, setDateFrom]      = useState("");
  const [dateTo, setDateTo]          = useState("");
  const [isPending, startTransition] = useTransition();
  const [checkedEmails, setCheckedEmails] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingUnmark, setConfirmingUnmark] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      if (search) {
        const q = search.toLowerCase();
        const matches =
          lead.firstName.toLowerCase().includes(q)  ||
          lead.lastName.toLowerCase().includes(q)   ||
          lead.email.toLowerCase().includes(q)      ||
          (lead.municipality?.toLowerCase().includes(q) ?? false);
        if (!matches) return false;
      }
      if (emailed === "emailed"     && !lead.emailedAt) return false;
      if (emailed === "not_emailed" &&  lead.emailedAt) return false;
      if (officeType && lead.officeType !== officeType) return false;
      if (dateFrom && new Date(lead.firstSeenAt) < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(lead.lastSeenAt) > to) return false;
      }
      return true;
    });
  }, [leads, search, emailed, officeType, dateFrom, dateTo]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((l) => checkedEmails.has(l.email));
  const someFilteredSelected = filtered.some((l) => checkedEmails.has(l.email));
  const selCount = checkedEmails.size;
  const selLabel = selCount === 1 ? "1 lead" : `${selCount} leads`;

  function clearSelection() {
    setCheckedEmails(new Set());
    setConfirmingDelete(false);
  }

  function updateFilter(fn: () => void) {
    fn();
    setCheckedEmails(new Set());
    setConfirmingDelete(false);
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setCheckedEmails(new Set());
    } else {
      setCheckedEmails(new Set(filtered.map((l) => l.email)));
    }
    setConfirmingDelete(false);
  }

  function toggleSelectOne(email: string) {
    setCheckedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
    setConfirmingDelete(false);
  }

  function executeBulkDelete() {
    startTransition(async () => {
      await deleteDemoLeads(Array.from(checkedEmails));
      setLeads((prev) => prev.filter((l) => !checkedEmails.has(l.email)));
      setCheckedEmails(new Set());
      setConfirmingDelete(false);
    });
  }

  function handleEmailedClick(lead: DemoLead) {
    if (lead.emailedAt) {
      // Already emailed — show confirmation before unmarking
      setConfirmingUnmark(lead.email);
    } else {
      // Not emailed — mark immediately
      startTransition(async () => {
        await markAsEmailed(lead.email);
        setLeads((prev) =>
          prev.map((l) => l.email === lead.email ? { ...l, emailedAt: new Date() } : l)
        );
      });
    }
  }

  function confirmUnmark() {
    if (!confirmingUnmark) return;
    const emailToUnmark = confirmingUnmark;
    setConfirmingUnmark(null);
    startTransition(async () => {
      await unmarkAsEmailed(emailToUnmark);
      setLeads((prev) =>
        prev.map((l) => l.email === emailToUnmark ? { ...l, emailedAt: null } : l)
      );
    });
  }

  function downloadCSV(csv: string, filename: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportFiltered() {
    startTransition(async () => {
      const csv = await exportDemoLeadsCSV({ search, emailed, officeType, dateFrom, dateTo });
      downloadCSV(csv, `demo-leads-filtered-${new Date().toISOString().slice(0, 10)}.csv`);
    });
  }

  function exportAll() {
    startTransition(async () => {
      const csv = await exportDemoLeadsCSV({});
      downloadCSV(csv, `demo-leads-all-${new Date().toISOString().slice(0, 10)}.csv`);
    });
  }

  return (
    <div>
      {/* Unmark confirmation modal */}
      {confirmingUnmark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConfirmingUnmark(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2">Unmark as emailed?</h3>
            <p className="text-sm text-slate-500 mb-5 leading-relaxed">
              This lead is currently marked as emailed. Are you sure you want to unmark it? They may receive the automated follow-up email again.
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmUnmark}
                disabled={isPending}
                className="flex-1 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Yes, unmark
              </button>
              <button
                onClick={() => setConfirmingUnmark(null)}
                className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Search name, email, municipality…"
          value={search}
          onChange={(e) => updateFilter(() => setSearch(e.target.value))}
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />

        <select
          value={emailed ?? "all"}
          onChange={(e) => updateFilter(() => setEmailed(e.target.value as LeadFilters["emailed"]))}
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All — emailed status</option>
          <option value="not_emailed">Not emailed</option>
          <option value="emailed">Emailed</option>
        </select>

        <select
          value={officeType}
          onChange={(e) => updateFilter(() => setOfficeType(e.target.value))}
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All office types</option>
          {OFFICE_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => updateFilter(() => setDateFrom(e.target.value))}
            className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            title="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => updateFilter(() => setDateTo(e.target.value))}
            className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            title="To date"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">
          Showing <strong className="text-slate-700">{filtered.length}</strong> of{" "}
          <strong className="text-slate-700">{leads.length}</strong> leads
        </p>
        <div className="flex gap-2">
          <button
            onClick={exportFiltered}
            disabled={isPending || filtered.length === 0}
            className="text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Export filtered
          </button>
          <button
            onClick={exportAll}
            disabled={isPending}
            className="text-xs font-medium px-3 py-1.5 rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            Export all
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selCount > 0 && (
        <div className="mb-3 flex items-center justify-between px-4 py-2.5 bg-slate-900 rounded-xl">
          {confirmingDelete ? (
            <>
              <p className="text-sm text-white font-medium">
                Permanently delete {selLabel}? This cannot be undone.
              </p>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={isPending}
                  className="text-sm text-slate-300 hover:text-white disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeBulkDelete}
                  disabled={isPending}
                  className="text-sm font-medium px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "Deleting…" : `Delete ${selLabel}`}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-white font-medium">{selCount} selected</p>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <button
                  onClick={clearSelection}
                  className="text-sm text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  disabled={isPending}
                  className="text-sm font-medium px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  Delete {selLabel}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">No leads match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      ref={(el) => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected; }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Name</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Emailed</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Municipality</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Office</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Visits</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden xl:table-cell">First seen</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden xl:table-cell">Last seen</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((lead) => (
                  <tr
                    key={lead.email}
                    className={[
                      "transition-colors",
                      lead.emailedAt
                        ? "bg-[#bbf7d0]"
                        : checkedEmails.has(lead.email)
                          ? "bg-brand-50"
                          : "hover:bg-slate-50/50",
                    ].join(" ")}
                  >
                    <td className="w-10 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={checkedEmails.has(lead.email)}
                        onChange={() => toggleSelectOne(lead.email)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
                        aria-label={`Select ${lead.firstName} ${lead.lastName}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{lead.firstName} {lead.lastName}</span>
                        {lead.converted && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                            Converted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleEmailedClick(lead)}
                        disabled={isPending}
                        title={lead.emailedAt ? `Emailed ${new Date(lead.emailedAt).toLocaleDateString("en-CA")}` : "Mark as emailed"}
                        className={[
                          "h-5 w-5 rounded border-2 flex items-center justify-center mx-auto transition-colors disabled:opacity-50",
                          lead.emailedAt
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-slate-300 hover:border-brand-400",
                        ].join(" ")}
                      >
                        {lead.emailedAt && (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <a href={`mailto:${lead.email}`} className="hover:text-brand-600 hover:underline">
                        {lead.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell whitespace-nowrap">
                      {lead.phone ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {lead.municipality ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell whitespace-nowrap">
                      {lead.officeType ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 font-medium hidden sm:table-cell">
                      {lead.registrations}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell whitespace-nowrap">
                      {new Date(lead.firstSeenAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden xl:table-cell whitespace-nowrap">
                      {new Date(lead.lastSeenAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {lead.source === "app" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                          App
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                          Demo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
