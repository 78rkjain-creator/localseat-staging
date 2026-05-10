export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canExportData } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { SUPPORT_LEVEL_LABELS } from "@/types";
import { csvRow, streamingCsvResponse } from "@/lib/csv-stream";
import type { Role, SupportLevel } from "@/types";

const CHUNK_SIZE = 500;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return new NextResponse("No active campaign", { status: 400 });
  if (!activeRole || !canExportData(activeRole as Role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const membership = await db.campaignMembership.findFirst({
    where: { userId: session.user.id, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!membership) return new NextResponse("Forbidden", { status: 403 });

  const campaignId = activeCampaignId;
  const date = new Date().toISOString().slice(0, 10);

  try {
    let totalRows = 0;

    const response = streamingCsvResponse(
      `people-export-${date}.csv`,
      [
        "First Name", "Last Name", "Email", "Phone (home)", "Phone (mobile)",
        "Street", "Unit", "City", "Province", "Postal Code",
        "Tags", "Support Level", "Notes Count", "Touches", "Availability", "Created Date",
      ],
      async (enqueue) => {
        let cursor: string | undefined;

        while (true) {
          const people = await db.person.findMany({
            where: { campaignId, deletedAt: null },
            include: {
              household: { include: { address: true } },
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
            orderBy: { id: "asc" },
            take: CHUNK_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          });

          if (people.length === 0) break;

          for (const p of people) {
            const addr = p.household?.address;
            const street = addr ? `${addr.streetNumber} ${addr.streetName}` : "";
            const tags = p.tags.map(({ tag }) => tag.name).join("; ");
            const rawLevel = p.canvassResponses[0]?.supportLevel;
            const supportLevel = rawLevel
              ? (SUPPORT_LEVEL_LABELS[rawLevel as SupportLevel] ?? rawLevel)
              : "";
            const touches = p._count.canvassResponses + p.outreachLogs.length;

            enqueue(csvRow([
              p.firstName, p.lastName, p.email, p.phoneHome, p.phoneMobile,
              street, addr?.unitNumber, addr?.city, addr?.province, addr?.postalCode,
              tags, supportLevel, p.notes.length, touches, p.availability,
              p.createdAt.toISOString().slice(0, 10),
            ]));
          }

          totalRows += people.length;
          cursor = people[people.length - 1].id;
          if (people.length < CHUNK_SIZE) break;
        }

        await createAuditLog({
          campaignId,
          userId: session.user.id,
          action: "EXPORT_VOTER_LIST",
          entityType: "export",
          details: {
            rowCount: totalRows,
            userRole: session.user.activeRole ?? null,
            format: "csv",
          },
        });
      }
    );

    return response;
  } catch {
    return NextResponse.json({ error: "Export failed." }, { status: 500 });
  }
}
