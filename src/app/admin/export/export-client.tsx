"use client";

import { useRef, useState, useTransition } from "react";
import { exportVoters, exportCampaigns, exportUsers, exportAuditLogs } from "./actions";
import type { ExportResult } from "./actions";
import type { SupportLevel } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function downloadCsv(csv: string, filename: string) {
  // BOM ensures Excel opens UTF-8 CSVs correctly
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "voters", label: "Voters" },
  { id: "campaigns", label: "Campaigns" },
  { id: "users", label: "Users" },
  { id: "audit_logs", label: "Audit Logs" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SUPPORT_LEVELS = [
  { value: "strong_yes", label: "Strong Yes" },
  { value: "soft_yes", label: "Soft Yes" },
  { value: "undecided", label: "Undecided" },
  { value: "soft_no", label: "Soft No" },
  { value: "strong_no", label: "Strong No" },
  { value: "not_home", label: "Not Home" },
];

const CAMPAIGN_ROLES = [
  { value: "candidate", label: "Candidate" },
  { value: "campaign_manager", label: "Campaign Manager" },
  { value: "field_organizer", label: "Field Organizer" },
  { value: "volunteer_coordinator", label: "Volunteer Coordinator" },
  { value: "canvasser", label: "Canvasser" },
  { value: "finance_lead", label: "Finance Lead" },
  { value: "co_chair", label: "Co-Chair" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 disabled:opacity-50";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  campaigns: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  users: { id: string; firstName: string; lastName: string; email: string }[];
}

// ── Main component ────────────────────────────────────────────────────────────

export function ExportClient({ campaigns, tags, users }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("voters");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const votersFormRef = useRef<HTMLFormElement>(null);
  const campaignsFormRef = useRef<HTMLFormElement>(null);
  const usersFormRef = useRef<HTMLFormElement>(null);
  const auditLogsFormRef = useRef<HTMLFormElement>(null);

  function switchTab(tab: TabId) {
    setActiveTab(tab);
    setError(null);
    setSuccessMsg(null);
  }

  function handleResult(result: ExportResult) {
    if (result.error) {
      setError(result.error);
    } else if (result.csv && result.filename) {
      downloadCsv(result.csv, result.filename);
      setSuccessMsg(`Downloaded ${result.filename}`);
    }
  }

  function handleExport(tab: TabId) {
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      if (tab === "voters" && votersFormRef.current) {
        const data = new FormData(votersFormRef.current);
        const tagIds = data.getAll("tagIds") as string[];
        handleResult(
          await exportVoters({
            campaignId: (data.get("campaignId") as string) || undefined,
            city: (data.get("city") as string) || undefined,
            supportLevel: ((data.get("supportLevel") as string) || undefined) as SupportLevel | undefined,
            tagIds: tagIds.length ? tagIds : undefined,
            dateFrom: (data.get("dateFrom") as string) || undefined,
            dateTo: (data.get("dateTo") as string) || undefined,
          })
        );
      } else if (tab === "campaigns" && campaignsFormRef.current) {
        const data = new FormData(campaignsFormRef.current);
        handleResult(
          await exportCampaigns({
            status: (data.get("status") as "active" | "inactive" | "deleted") || undefined,
            municipality: (data.get("municipality") as string) || undefined,
            city: (data.get("city") as string) || undefined,
            electionDateFrom: (data.get("electionDateFrom") as string) || undefined,
            electionDateTo: (data.get("electionDateTo") as string) || undefined,
          })
        );
      } else if (tab === "users" && usersFormRef.current) {
        const data = new FormData(usersFormRef.current);
        handleResult(
          await exportUsers({
            platformRole: (data.get("platformRole") as string) || undefined,
            campaignRole: (data.get("campaignRole") as string) || undefined,
            campaignId: (data.get("campaignId") as string) || undefined,
            status: (data.get("status") as "active" | "deactivated") || undefined,
            city: (data.get("city") as string) || undefined,
          })
        );
      } else if (tab === "audit_logs" && auditLogsFormRef.current) {
        const data = new FormData(auditLogsFormRef.current);
        handleResult(
          await exportAuditLogs({
            action: (data.get("action") as string) || undefined,
            userId: (data.get("userId") as string) || undefined,
            campaignId: (data.get("campaignId") as string) || undefined,
            dateFrom: (data.get("dateFrom") as string) || undefined,
            dateTo: (data.get("dateTo") as string) || undefined,
          })
        );
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-slate-100 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchTab(tab.id)}
            className={[
              "px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.id
                ? "text-orange-600 border-b-2 border-orange-500 -mb-px"
                : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* ── Voters form ── */}
        {activeTab === "voters" && (
          <form
            ref={votersFormRef}
            onSubmit={(e) => { e.preventDefault(); handleExport("voters"); }}
          >
            <p className="text-xs text-slate-400 mb-5">
              Export voter / supporter records with address, support level, and tag data.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FilterField label="Campaign">
                <select name="campaignId" className={inputClass}>
                  <option value="">All campaigns</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Support Level">
                <select name="supportLevel" className={inputClass}>
                  <option value="">All levels</option>
                  {SUPPORT_LEVELS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="City">
                <input
                  type="text"
                  name="city"
                  placeholder="e.g. Hamilton"
                  className={inputClass}
                />
              </FilterField>

              <FilterField label="Date Added — From">
                <input type="date" name="dateFrom" className={inputClass} />
              </FilterField>

              <FilterField label="Date Added — To">
                <input type="date" name="dateTo" className={inputClass} />
              </FilterField>

              {tags.length > 0 && (
                <FilterField label="Tags (hold Ctrl / Cmd for multiple)">
                  <select
                    name="tagIds"
                    multiple
                    size={Math.min(5, tags.length)}
                    className={inputClass + " h-auto"}
                  >
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </FilterField>
              )}
            </div>
            <ExportFooter isPending={isPending} error={error} successMsg={successMsg} />
          </form>
        )}

        {/* ── Campaigns form ── */}
        {activeTab === "campaigns" && (
          <form
            ref={campaignsFormRef}
            onSubmit={(e) => { e.preventDefault(); handleExport("campaigns"); }}
          >
            <p className="text-xs text-slate-400 mb-5">
              Export all campaigns including inactive and soft-deleted records.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FilterField label="Status">
                <select name="status" className={inputClass}>
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="deleted">Deleted</option>
                </select>
              </FilterField>

              <FilterField label="Municipality">
                <input
                  type="text"
                  name="municipality"
                  placeholder="e.g. City of Hamilton"
                  className={inputClass}
                />
              </FilterField>

              <FilterField label="City">
                <input
                  type="text"
                  name="city"
                  placeholder="e.g. Hamilton"
                  className={inputClass}
                />
              </FilterField>

              <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                <FilterField label="Election Date — From">
                  <input type="date" name="electionDateFrom" className={inputClass} />
                </FilterField>
                <FilterField label="Election Date — To">
                  <input type="date" name="electionDateTo" className={inputClass} />
                </FilterField>
              </div>
            </div>
            <ExportFooter isPending={isPending} error={error} successMsg={successMsg} />
          </form>
        )}

        {/* ── Users form ── */}
        {activeTab === "users" && (
          <form
            ref={usersFormRef}
            onSubmit={(e) => { e.preventDefault(); handleExport("users"); }}
          >
            <p className="text-xs text-slate-400 mb-5">
              Export user accounts with campaign memberships. One row per user × campaign.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FilterField label="Platform Role">
                <select name="platformRole" className={inputClass}>
                  <option value="">All</option>
                  <option value="super_user">Super User</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="none">No platform role</option>
                </select>
              </FilterField>

              <FilterField label="Campaign Role">
                <select name="campaignRole" className={inputClass}>
                  <option value="">All roles</option>
                  {CAMPAIGN_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Campaign">
                <select name="campaignId" className={inputClass}>
                  <option value="">All campaigns</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Account Status">
                <select name="status" className={inputClass}>
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </FilterField>

              <FilterField label="City (campaign city)">
                <input
                  type="text"
                  name="city"
                  placeholder="e.g. Hamilton"
                  className={inputClass}
                />
              </FilterField>
            </div>
            <ExportFooter isPending={isPending} error={error} successMsg={successMsg} />
          </form>
        )}

        {/* ── Audit Logs form ── */}
        {activeTab === "audit_logs" && (
          <form
            ref={auditLogsFormRef}
            onSubmit={(e) => { e.preventDefault(); handleExport("audit_logs"); }}
          >
            <p className="text-xs text-slate-400 mb-5">
              Export the full audit log. Large date ranges may produce large files.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FilterField label="Action (partial match)">
                <input
                  type="text"
                  name="action"
                  placeholder="e.g. LOGIN, CAMPAIGN, VOTER"
                  className={inputClass}
                />
              </FilterField>

              <FilterField label="User">
                <select name="userId" className={inputClass}>
                  <option value="">All users</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} — {u.email}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Campaign">
                <select name="campaignId" className={inputClass}>
                  <option value="">All campaigns</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </FilterField>

              <div className="grid grid-cols-2 gap-4">
                <FilterField label="Date — From">
                  <input type="date" name="dateFrom" className={inputClass} />
                </FilterField>
                <FilterField label="Date — To">
                  <input type="date" name="dateTo" className={inputClass} />
                </FilterField>
              </div>
            </div>
            <ExportFooter isPending={isPending} error={error} successMsg={successMsg} />
          </form>
        )}
      </div>
    </div>
  );
}

// ── Footer shared across all forms ────────────────────────────────────────────

function ExportFooter({
  isPending,
  error,
  successMsg,
}: {
  isPending: boolean;
  error: string | null;
  successMsg: string | null;
}) {
  return (
    <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <>
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Exporting…
          </>
        ) : (
          "Export CSV"
        )}
      </button>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {successMsg && !error && (
        <p className="text-sm text-green-600">{successMsg}</p>
      )}

      {!error && !successMsg && (
        <p className="text-xs text-slate-400">
          No filters = export all records. Download starts automatically.
        </p>
      )}
    </div>
  );
}
