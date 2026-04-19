export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { SUPPORT_LEVEL_LABELS } from "@/types";
import type { SupportLevel } from "@/types";

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
  if (!session?.user?.activeCampaignId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const campaignId = session.user.activeCampaignId;

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
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const headers = row([
    "First Name", "Last Name", "Email", "Phone (home)", "Phone (mobile)",
    "Street", "Unit", "City", "Province", "Postal Code", "Poll Number",
    "Tags", "Support Level", "Notes Count", "Created Date", "Import Source",
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

    return row([
      p.firstName, p.lastName, p.email, p.phoneHome, p.phoneMobile,
      street, addr?.unitNumber, addr?.city, addr?.province, addr?.postalCode,
      p.pollNumber,
      tags, supportLevel, p.notes.length,
      p.createdAt.toISOString().slice(0, 10),
      p.importSource,
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
      "Content-Disposition": `attachment; filename="voter-list-export-${date}.csv"`,
    },
  });
}
