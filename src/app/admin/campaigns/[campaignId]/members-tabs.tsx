"use client";

import { useState } from "react";
import type { Role } from "@/types";
import { ROLE_LABELS } from "@/types";
import type { AdminMemberEntry } from "./members-panel";
import { MembersPanel } from "./members-panel";

const CAMPAIGN_TEAM_ROLES = new Set([
  "candidate",
  "campaign_manager",
  "data_manager",
  "co_chair",
  "field_organizer",
  "finance_lead",
]);

const FIELD_TEAM_ROLES = new Set([
  "canvasser",
  "sign_installer",
  "volunteer_coordinator",
]);

type Tab = "campaign" | "field";

interface Props {
  campaignId:      string;
  members:         AdminMemberEntry[];
  isSuperUser:     boolean;
}

export function MembersTabs({ campaignId, members, isSuperUser }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("campaign");

  const campaignTeam = members.filter((m) => CAMPAIGN_TEAM_ROLES.has(m.role));
  const fieldTeam    = members.filter((m) => FIELD_TEAM_ROLES.has(m.role));
  const visible      = activeTab === "campaign" ? campaignTeam : fieldTeam;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "campaign", label: "Campaign Team", count: campaignTeam.length },
    { id: "field",    label: "Field Team",    count: fieldTeam.length    },
  ];

  return (
    <>
      {/* Tab bar */}
      <div className="px-6 pt-1 pb-0 border-b border-slate-100 flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "px-3 py-2.5 text-xs font-semibold rounded-t-lg transition-colors relative -mb-px",
              activeTab === tab.id
                ? "text-slate-900 bg-white border border-b-white border-slate-100"
                : "text-slate-400 hover:text-slate-600",
            ].join(" ")}
          >
            {tab.label}
            <span
              className={[
                "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-px text-[10px] font-semibold min-w-[18px]",
                activeTab === tab.id
                  ? "bg-slate-100 text-slate-700"
                  : "bg-slate-50 text-slate-400",
              ].join(" ")}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {visible.length === 0 ? (
        <p className="px-6 py-8 text-sm text-slate-400 text-center">No members in this group.</p>
      ) : isSuperUser ? (
        <MembersPanel campaignId={campaignId} members={visible} />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Email</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Role</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {visible.map((m) => (
              <tr key={m.id} className={m.deletedAt ? "opacity-40" : ""}>
                <td className="px-5 py-3 font-medium text-slate-900">
                  {m.user.firstName} {m.user.lastName}
                </td>
                <td className="px-5 py-3 hidden md:table-cell text-slate-500 truncate max-w-[200px]">
                  {m.user.email}
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {ROLE_LABELS[m.role as Role] ?? m.role}
                </td>
                <td className="px-5 py-3 hidden lg:table-cell text-slate-400 tabular-nums">
                  {new Date(m.createdAt).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
