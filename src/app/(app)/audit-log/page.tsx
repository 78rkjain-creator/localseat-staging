import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/types";
import { AuditLogClient } from "./audit-log-client";

const ALLOWED_ROLES: Role[] = ["candidate", "campaign_manager", "data_manager"];
const LIMIT = 200;

export default async function CampaignAuditLogPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;

  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !ALLOWED_ROLES.includes(activeRole as Role)) redirect("/dashboard");

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where: { campaignId: activeCampaignId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    db.auditLog.count({ where: { campaignId: activeCampaignId } }),
  ]);

  // Build unique user options from entries that have a user
  const seenIds = new Set<string>();
  const users: { id: string; label: string }[] = [];
  for (const e of entries) {
    if (e.userId && e.user && !seenIds.has(e.userId)) {
      seenIds.add(e.userId);
      users.push({ id: e.userId, label: `${e.user.firstName} ${e.user.lastName}` });
    }
  }
  users.sort((a, b) => a.label.localeCompare(b.label));

  // Attach userId so client-side filtering works
  const typedEntries = entries.map((e) => ({
    ...e,
    campaign: undefined,
  }));

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-500">
          Activity history for this campaign. All times shown in Eastern Time (ET).
        </p>
      </div>

      <AuditLogClient
        entries={typedEntries}
        users={users}
        total={total}
        truncated={total > LIMIT}
      />
    </div>
  );
}
