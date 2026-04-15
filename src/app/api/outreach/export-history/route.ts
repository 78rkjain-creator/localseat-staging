import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageFollowUps } from "@/lib/permissions";
import { getAllOutreachLogsForExport } from "@/lib/outreach";
import { OUTREACH_CHANNEL_LABELS } from "@/types";
import type { Role, OutreachChannel } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return new Response("No active campaign", { status: 400 });
  if (!activeRole || !canManageFollowUps(activeRole as Role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const logs = await getAllOutreachLogsForExport(activeCampaignId);

  const headers = [
    "First Name", "Last Name", "Address", "Phone (home)",
    "Channel", "Date", "Outcome", "Notes",
    "Staff Member", "Phoned By", "Phone Type",
  ];

  const rows = logs.map((l) => {
    const addr = l.person.household?.address;
    const address = addr
      ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}, ${addr.city}, ${addr.province} ${addr.postalCode}`
      : "";
    const staffName = l.user ? `${l.user.firstName} ${l.user.lastName}` : "";
    const channelLabel = OUTREACH_CHANNEL_LABELS[l.channel as OutreachChannel] ?? l.channel;

    return [
      l.person.firstName,
      l.person.lastName,
      address,
      l.person.phoneHome ?? "",
      channelLabel,
      l.date.toISOString().split("T")[0],
      l.outcome ?? "",
      l.notes ?? "",
      staffName,
      l.phonedBy ?? "",
      l.phoneType ?? "",
    ];
  });

  const csv = [headers, ...rows].map(csvRow).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="outreach-history.csv"`,
    },
  });
}

function csvRow(fields: string[]): string {
  return fields.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(",");
}
