import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { SUPPORT_LEVEL_LABELS } from "@/types";
import type { SupportLevel } from "@/types";

function esc(val: string | boolean | number | null | undefined): string {
  if (val == null) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(fields: (string | boolean | number | null | undefined)[]): string {
  return fields.map(esc).join(",");
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const campaignId = session.user.activeCampaignId;
  const listId = req.nextUrl.searchParams.get("listId") ?? undefined;

  // Fetch entries scoped to the campaign, optionally filtered by listId
  const entries = await db.canvassListEntry.findMany({
    where: {
      deletedAt: null,
      canvassList: {
        campaignId,
        ...(listId ? { id: listId } : {}),
        deletedAt: null,
      },
    },
    include: {
      canvassList: { select: { name: true } },
      person: {
        include: {
          household: { include: { address: true } },
          canvassResponses: {
            where: {
              assignment: {
                canvassList: {
                  campaignId,
                  ...(listId ? { id: listId } : {}),
                },
              },
            },
            orderBy: { respondedAt: "desc" },
            take: 1,
            include: {
              assignment: {
                include: {
                  canvasser: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { canvassList: { name: "asc" } },
      { person: { lastName: "asc" } },
      { person: { firstName: "asc" } },
    ],
  });

  const headers = row([
    "Walk List", "First Name", "Last Name",
    "Street", "Unit", "City", "Province", "Postal Code",
    "Support Level", "Sign Request", "Volunteer Interest", "Donor Interest",
    "Notes", "Canvass Date", "Canvasser",
  ]);

  const rows = entries.map((entry) => {
    const person = entry.person;
    const addr = person.household?.address;
    const street = addr ? `${addr.streetNumber} ${addr.streetName}` : "";
    const response = person.canvassResponses[0];
    const rawLevel = response?.supportLevel;
    const supportLevel = rawLevel
      ? (SUPPORT_LEVEL_LABELS[rawLevel as SupportLevel] ?? rawLevel)
      : "";
    const canvasserName = response
      ? `${response.assignment.canvasser.firstName} ${response.assignment.canvasser.lastName}`
      : "";
    const canvassDate = response
      ? new Date(response.respondedAt).toISOString().slice(0, 10)
      : "";

    return row([
      entry.canvassList.name,
      person.firstName, person.lastName,
      street, addr?.unitNumber, addr?.city, addr?.province, addr?.postalCode,
      supportLevel,
      response?.signRequest ?? false,
      response?.volunteerInterest ?? false,
      response?.donorInterest ?? false,
      response?.notes,
      canvassDate, canvasserName,
    ]);
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "EXPORT_WALK_LIST",
    entityType: "export",
    details: {
      rowCount: entries.length,
      userRole: session.user.activeRole ?? null,
      filters: { listId: listId ?? null },
      format: "csv",
    },
  });

  const csv = [headers, ...rows].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="walklist-export-${date}.csv"`,
    },
  });
}
