import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEffectiveLimits } from "@/lib/plan-limits";
import { getPendingAddressChangeCount } from "@/lib/address-changes";
import { getPendingVoterChangeCount } from "@/lib/voter-change-requests";
import {
  canViewTeam,
  canManageSuppliers,
  canReviewDataImports,
  canReviewAddressChanges,
} from "@/lib/permissions";
import type { Role } from "@/types";
import type { ReactNode } from "react";
import {
  Settings,
  Mail,
  AlignLeft,
  Tag,
  AlertCircle,
  Users,
  File,
  Shield,
  ClipboardList,
  PenLine,
  Map,
  FileText,
  Clipboard,
} from "lucide-react";

export const metadata: Metadata = { title: "Settings" };

export default async function CampaignSettingsHubPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");

  const role = activeRole as Role | null;

  const isAdmin = role === "candidate" || role === "campaign_manager" || role === "data_manager";
  const isAdminOrChair = isAdmin || role === "co_chair";

  if (
    !isAdminOrChair &&
    !(role && canViewTeam(role)) &&
    !(role && canManageSuppliers(role)) &&
    !(role && canReviewDataImports(role)) &&
    !(role && canReviewAddressChanges(role))
  ) {
    redirect("/dashboard");
  }

  const limits = await getEffectiveLimits(activeCampaignId);
  const { surveysEnabled, digitalSignaturesEnabled, reportsEnabled, customFieldsEnabled, canvassScriptEnabled } = limits;

  const pendingDataCorrectionsCount =
    role && canReviewAddressChanges(role)
      ? await Promise.all([
          getPendingAddressChangeCount(activeCampaignId),
          getPendingVoterChangeCount(activeCampaignId),
        ]).then(([a, b]) => a + b)
      : 0;

  let constituentUsage: { count: number; limit: number } | null = null;
  let tagUsage: { count: number; limit: number } | null = null;

  if (role === "candidate" || role === "campaign_manager") {
    if (!limits.isUnlimited("constituentLimit") && limits.constituentLimit > 0) {
      const count = await db.person.count({ where: { campaignId: activeCampaignId, deletedAt: null } });
      constituentUsage = { count, limit: limits.constituentLimit };
    }
    if (!limits.isUnlimited("tagLimit") && limits.tagLimit > 0) {
      const count = await db.tag.count({ where: { campaignId: activeCampaignId, deletedAt: null } });
      tagUsage = { count, limit: limits.tagLimit };
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-8">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-5">
          {/* General */}
          {(isAdmin || (reportsEnabled && isAdminOrChair)) && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                General
              </p>
              {isAdmin && (
                <SettingsItem href="/campaign-settings/general" label="General" icon={<Settings size={16} />} />
              )}
              {reportsEnabled && isAdminOrChair && (
                <SettingsItem href="/campaign-settings/reports" label="Email reports" icon={<Mail size={16} />} />
              )}
            </div>
          )}

          {/* People & Data */}
          {(isAdmin ||
            (role && canReviewAddressChanges(role)) ||
            (role && canManageSuppliers(role)) ||
            (role && canReviewDataImports(role))) && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                People &amp; data
              </p>
              {customFieldsEnabled && isAdmin && (
                <SettingsItem href="/campaign-settings/custom-fields" label="Custom fields" icon={<AlignLeft size={16} />} />
              )}
              {isAdmin && (
                <SettingsItem href="/campaign-settings/tags" label="Custom tags" icon={<Tag size={16} />} />
              )}
              {role && canReviewAddressChanges(role) && (
                <SettingsItem
                  href="/campaign-settings/data-corrections"
                  label="Data corrections"
                  icon={<AlertCircle size={16} />}
                  badge={pendingDataCorrectionsCount > 0 ? pendingDataCorrectionsCount : undefined}
                />
              )}
              {role && canManageSuppliers(role) && (
                <SettingsItem href="/campaign-settings/suppliers" label="Data suppliers" icon={<Users size={16} />} />
              )}
              {role && canReviewDataImports(role) && (
                <SettingsItem href="/campaign-settings/imports" label="Data imports" icon={<File size={16} />} />
              )}
              {isAdmin && (
                <SettingsItem href="/campaign-settings/privacy" label="Privacy & data" icon={<Shield size={16} />} />
              )}
              {surveysEnabled && isAdmin && (
                <SettingsItem href="/campaign-settings/surveys" label="Surveys" icon={<ClipboardList size={16} />} />
              )}
              {digitalSignaturesEnabled && isAdmin && (
                <SettingsItem href="/campaign-settings/signature-consents" label="Consent types" icon={<PenLine size={16} />} />
              )}
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-5 mt-5 md:mt-0">
          {/* Campaign */}
          {isAdminOrChair && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Campaign
              </p>
              <SettingsItem href="/campaign-settings/ward" label="Ward boundary" icon={<Map size={16} />} />
              <SettingsItem href="/campaign-settings/competitors" label="Competitors" icon={<Users size={16} />} />
              {canvassScriptEnabled && (
                <SettingsItem href="/campaign-settings/script" label="Canvassing script" icon={<FileText size={16} />} />
              )}
            </div>
          )}

          {/* Team & Audit */}
          {((role && canViewTeam(role)) || isAdmin) && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Team &amp; audit
              </p>
              {role && canViewTeam(role) && (
                <SettingsItem href="/team" label="Team setup" icon={<Users size={16} />} />
              )}
              {isAdmin && (
                <SettingsItem href="/audit-log" label="Audit log" icon={<Clipboard size={16} />} />
              )}
            </div>
          )}

          {/* Usage indicators */}
          {(constituentUsage || tagUsage) && (
            <div className="flex flex-col gap-2 pt-2">
              {constituentUsage && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400">Records</span>
                    <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                      {constituentUsage.count.toLocaleString()} / {constituentUsage.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={[
                        "h-full rounded-full transition-all",
                        constituentUsage.count / constituentUsage.limit >= 0.9
                          ? "bg-red-400"
                          : constituentUsage.count / constituentUsage.limit >= 0.75
                          ? "bg-amber-400"
                          : "bg-slate-400",
                      ].join(" ")}
                      style={{ width: `${Math.min(100, Math.round((constituentUsage.count / constituentUsage.limit) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
              {tagUsage && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400">Tags</span>
                    <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                      {tagUsage.count.toLocaleString()} / {tagUsage.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={[
                        "h-full rounded-full transition-all",
                        tagUsage.count / tagUsage.limit >= 0.9
                          ? "bg-red-400"
                          : tagUsage.count / tagUsage.limit >= 0.75
                          ? "bg-amber-400"
                          : "bg-slate-400",
                      ].join(" ")}
                      style={{ width: `${Math.min(100, Math.round((tagUsage.count / tagUsage.limit) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SettingsItem({
  href,
  label,
  icon,
  badge,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-slate-700"
    >
      <span className="text-slate-400 flex-shrink-0">{icon}</span>
      <span>{label}</span>
      {badge !== undefined && (
        <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-semibold bg-amber-500 text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
