export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canExportData } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { SUPPORT_LEVEL_LABELS } from "@/types";
import type { Role, SupportLevel } from "@/types";

function esc(val: string | number | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(fields: (string | number | null | undefined)[]): string {
  return fields.map(esc).join(",");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return new NextResponse("No active campaign", { status: 400 });
  if (!activeRole || !canExportData(activeRole as Role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Re-verify the user still has an active membership in this campaign.
  const membership = await db.campaignMembership.findFirst({
    where: { userId: session.user.id, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!membership) return new NextResponse("Forbidden", { status: 403 });

  const campaignId = activeCampaignId;

  try {
  const people = await db.person.findMany({
    where: { campaignId, deletedAt: null },
    include: {
      household: {
        include: { address: true },
      },
      tags: { include: { tag: true } },
      notes: { select: { id: true } },
      canvassResponses: {
        orderBy: { respondedAt: "desc" },
        take: 1,
        select: { supportLevel: true },
      },
      outreachLogs: { where: { deletedAt: null }, select: { id: true } },
      _count: { select: { canvassResponses: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const headers = row([
    "First Name", "Last Name", "Email", "Phone (home)", "Phone (mobile)",
    "Street", "Unit", "City", "Province", "Postal Code",
    "Tags", "Support Level", "Notes Count", "Touches", "Availability", "Created Date",
  ]);

  const rows = people.map((p) => {
    const addr = p.household?.address;
    const street = addr
      ? `${addr.streetNumber} ${addr.streetName}`
      : "";
    const tags = p.tags.map(({ tag }) => tag.name).join("; ");
    const rawLevel = p.canvassResponses[0]?.supportLevel;
    const supportLevel = rawLevel
      ? (SUPPORT_LEVEL_LABELS[rawLevel as SupportLevel] ?? rawLevel)
      : "";

    const touches = p._count.canvassResponses + p.outreachLogs.length;

    return row([
      p.firstName, p.lastName, p.email, p.phoneHome, p.phoneMobile,
      street, addr?.unitNumber, addr?.city, addr?.province, addr?.postalCode,
      tags, supportLevel, p.notes.length, touches, p.availability,
      p.createdAt.toISOString().slice(0, 10),
    ]);
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "EXPORT_VOTER_LIST",
    entityType: "export",
    details: {
      rowCount: people.length,
      userRole: session.user.activeRole ?? null,
      format: "csv",
    },
  });

  const csv = [headers, ...rows].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="people-export-${date}.csv"`,
    },
  });
  } catch {
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}
