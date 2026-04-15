import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageFollowUps } from "@/lib/permissions";
import { getPeopleForExportTemplate } from "@/lib/outreach";
import type { NextRequest } from "next/server";
import type { Role, OutreachChannel } from "@/types";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return new Response("No active campaign", { status: 400 });
  if (!activeRole || !canManageFollowUps(activeRole as Role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const channel = (req.nextUrl.searchParams.get("channel") ?? "phone_call") as OutreachChannel;
  const supportLevel = req.nextUrl.searchParams.get("supportLevel") || undefined;
  const people = await getPeopleForExportTemplate(activeCampaignId, supportLevel);

  const headers = [
    "First Name", "Last Name", "Address", "Phone (home)", "Email",
    "Channel", "Date", "Outcome", "Notes", "Phoned By", "Phone Type",
  ];

  const rows = people.map((p) => {
    const addr = p.household?.address;
    const address = addr
      ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}, ${addr.city}, ${addr.province} ${addr.postalCode}`
      : "";
    return [
      p.firstName,
      p.lastName,
      address,
      p.phoneHome ?? "",
      p.email ?? "",
      channel,
      "", // Date — blank for provider
      "", // Outcome — blank for provider
      "", // Notes — blank for provider
      "", // Phoned By — blank for provider
      "", // Phone Type — blank for provider
    ];
  });

  const csv = [headers, ...rows].map(csvRow).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="outreach-template-${channel}.csv"`,
    },
  });
}

function csvRow(fields: string[]): string {
  return fields.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(",");
}
