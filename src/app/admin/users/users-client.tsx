"use client";

import { useState } from "react";
import Link from "next/link";
import { ROLE_LABELS } from "@/types";
import type { Role } from "@/types";

interface Membership {
  role: string;
  campaign: { id: string; name: string };
}

export interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  platformRole: string | null;
  createdAt: Date;
  memberships: Membership[];
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        isActive
          ? "bg-green-50 text-green-700"
          : "bg-amber-50 text-amber-700",
      ].join(" ")}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function CampaignPills({ memberships }: { memberships: Membership[] }) {
  if (memberships.length === 0) {
    return <span className="text-xs text-slate-300">No campaigns</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {memberships.map((m) => (
        <Link
          key={m.campaign.id + m.role}
          href={`/admin/campaigns/${m.campaign.id}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <span className="text-xs font-medium text-slate-700 truncate max-w-[140px]">
            {m.campaign.name}
          </span>
          <span className="text-[10px] text-slate-400 flex-shrink-0">
            {ROLE_LABELS[m.role as Role] ?? m.role}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function UsersClient({ users }: { users: UserRow[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter(
        (u) =>
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
    : users;

  return (
    <>
      {/* Search bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Clear search"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 whitespace-nowrap">
          {q
            ? `Showing ${filtered.length} of ${users.length} users`
            : `${users.length} user${users.length !== 1 ? "s" : ""} total`}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            {q ? "No users match your search." : "No users found."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                  Email
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                  Campaigns
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                  Joined
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className={[
                    "hover:bg-slate-50 transition-colors",
                    !u.isActive ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {u.firstName} {u.lastName}
                      {u.platformRole && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                          {u.platformRole === "super_user" ? "Super User" : "Super Admin"}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 md:hidden mt-0.5 truncate">
                      {u.email}
                    </p>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-slate-600 truncate max-w-[200px]">
                    {u.email}
                  </td>
                  <td className="px-5 py-4">
                    <ActiveBadge isActive={u.isActive} />
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <CampaignPills memberships={u.memberships} />
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell text-slate-500 tabular-nums">
                    {new Date(u.createdAt).toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
