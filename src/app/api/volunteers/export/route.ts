export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewVolunteers } from "@/lib/permissions";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { csvRow, streamingCsvResponse } from "@/lib/csv-stream";
import type { Role } from "@/types";

const CHUNK_SIZE = 500;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return new Response("No active campaign", { status: 400 });
  if (!activeRole || !canViewVolunteers(activeRole as Role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const membership = await db.campaignMembership.findFirst({
    where: { userId: session.user.id, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });
  if (!membership) return new Response("Forbidden", { status: 403 });

  try {
    let totalRows = 0;

    const response = streamingCsvResponse(
      "volunteers.csv",
      [
        "First Name", "Last Name",
        "Address", "City", "Province", "Postal Code",
        "Phone (home)", "Phone (mobile)", "Email",
        "Flagged At",
      ],
      async (enqueue) => {
        let cursor: string | undefined;

        while (true) {
          const responses = await db.canvassResponse.findMany({
            where: {
              person: { campaignId: activeCampaignId, deletedAt: null },
              volunteerInterest: true,
            },
            distinct: ["personId"],
            orderBy: { id: "asc" },
            select: {
              id: true,
              respondedAt: true,
              person: {
                select: {
                  firstName: true,
                  lastName: true,
                  phoneHome: true,
                  phoneMobile: true,
                  email: true,
                  household: {
                    select: {
                      address: {
                        select: {
                          streetNumber: true, streetName: true, unitNumber: true,
                          city: true, province: true, postalCode: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            take: CHUNK_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          });

          if (responses.length === 0) break;

          for (const r of responses) {
            const p = r.person;
            const addr = p.household?.address;
            const streetLine = addr
              ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
              : "";

            enqueue(csvRow([
              p.firstName, p.lastName,
              streetLine, addr?.city ?? "", addr?.province ?? "", addr?.postalCode ?? "",
              p.phoneHome ?? "", p.phoneMobile ?? "", p.email ?? "",
              r.respondedAt.toISOString().split("T")[0],
            ]));
          }

          totalRows += responses.length;
          cursor = responses[responses.length - 1].id;
          if (responses.length < CHUNK_SIZE) break;
        }

        await createAuditLog({
          campaignId: activeCampaignId,
          userId: session.user.id,
          action: "EXPORT_VOLUNTEERS",
          entityType: "export",
          details: {
            rowCount: totalRows,
            userRole: activeRole,
            format: "csv",
          },
        });
      }
    );

    return response;
  } catch {
    return Response.json({ error: "Export failed." }, { status: 500 });
  }
}
