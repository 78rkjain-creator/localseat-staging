"use client";

import { useState, useTransition, useMemo } from "react";
import type { DemoLead, LeadFilters } from "./actions";
import { markAsEmailed, unmarkAsEmailed, exportDemoLeadsCSV } from "./actions";

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
  const [leads, setLeads]             = useState<DemoLead[]>(initialLeads);
  const [search, setSearch]           = useState("");
  const [emailed, setEmailed]         = useState<LeadFilters["emailed"]>("all");
  const [officeType, setOfficeType]   = useState("");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [isPending, startTransition]  = useTransition();

  // Client-side filter (data is already loaded server-side; this handles interactive updates)
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

  function toggleEmailed(lead: DemoLead) {
    startTransition(async () => {
      if (lead.emailedAt) {
        await unmarkAsEmailed(lead.email);
        setLeads((prev) =>
          prev.map((l) => l.email === lead.email ? { ...l, emailedAt: null } : l)
        );
      } else {
        await markAsEmailed(lead.email);
        setLeads((prev) =>
          prev.map((l) => l.email === lead.email ? { ...l, emailedAt: new Date() } : l)
        );
      }
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
      {/* Filters */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Search name, email, municipality…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />

        <select
          value={emailed ?? "all"}
          onChange={(e) => setEmailed(e.target.value as LeadFilters["emailed"])}
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All — emailed status</option>
          <option value="not_emailed">Not emailed</option>
          <option value="emailed">Emailed</option>
        </select>

        <select
          value={officeType}
          onChange={(e) => setOfficeType(e.target.value)}
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
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            title="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
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

      {/* Table */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">No leads match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Municipality</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Office</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Visits</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden xl:table-cell">First seen</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden xl:table-cell">Last seen</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell">Source</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Emailed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((lead) => (
                  <tr key={lead.email} className="hover:bg-slate-50/50 transition-colors">
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
                      {lead.source === "app_signup" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                          Signup
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                          Demo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleEmailed(lead)}
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
