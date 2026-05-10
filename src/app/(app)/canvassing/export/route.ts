export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canExportData } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { SUPPORT_LEVEL_LABELS } from "@/types";
import { csvRow, streamingCsvResponse } from "@/lib/csv-stream";
import type { Role, SupportLevel } from "@/types";

const CHUNK_SIZE = 500;

export async function GET(req: NextRequest) {
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
  const listId = req.nextUrl.searchParams.get("listId") ?? undefined;
  const date = new Date().toISOString().slice(0, 10);

  try {
    let totalRows = 0;

    const response = streamingCsvResponse(
      `walklist-export-${date}.csv`,
      [
        "Walk List", "First Name", "Last Name",
        "Street", "Unit", "City", "Province", "Postal Code",
        "Support Level", "Sign Request", "Volunteer Interest", "Donor Interest",
        "Notes", "Canvass Date", "Canvasser",
      ],
      async (enqueue) => {
        let cursor: string | undefined;

        while (true) {
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
            orderBy: { id: "asc" },
            take: CHUNK_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          });

          if (entries.length === 0) break;

          for (const entry of entries) {
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

            enqueue(csvRow([
              entry.canvassList.name,
              person.firstName, person.lastName,
              street, addr?.unitNumber, addr?.city, addr?.province, addr?.postalCode,
              supportLevel,
              response?.signRequest ?? false,
              response?.volunteerInterest ?? false,
              response?.donorInterest ?? false,
              response?.notes,
              canvassDate, canvasserName,
            ]));
          }

          totalRows += entries.length;
          cursor = entries[entries.length - 1].id;
          if (entries.length < CHUNK_SIZE) break;
        }

        await createAuditLog({
          campaignId,
          userId: session.user.id,
          action: "EXPORT_WALK_LIST",
          entityType: "export",
          details: {
            rowCount: totalRows,
            userRole: session.user.activeRole ?? null,
            filters: { listId: listId ?? null },
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
