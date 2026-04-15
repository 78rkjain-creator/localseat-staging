import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewVolunteers } from "@/lib/permissions";
import { db } from "@/lib/db";
import type { Role } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return new Response("No active campaign", { status: 400 });
  if (!activeRole || !canViewVolunteers(activeRole as Role)) {
    return new Response("Forbidden", { status: 403 });
  }

  // Get all people whose most recent canvass response includes volunteerInterest: true
  const responses = await db.canvassResponse.findMany({
    where: {
      person: { campaignId: activeCampaignId, deletedAt: null },
      volunteerInterest: true,
    },
    distinct: ["personId"],
    orderBy: { respondedAt: "desc" },
    select: {
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
                  streetNumber: true,
                  streetName: true,
                  unitNumber: true,
                  city: true,
                  province: true,
                  postalCode: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const headers = [
    "First Name", "Last Name",
    "Address", "City", "Province", "Postal Code",
    "Phone (home)", "Phone (mobile)", "Email",
    "Flagged At",
  ];

  const rows = responses.map((r) => {
    const p = r.person;
    const addr = p.household?.address;
    const streetLine = addr
      ? `${addr.streetNumber} ${addr.streetName}${addr.unitNumber ? ` #${addr.unitNumber}` : ""}`
      : "";
    return [
      p.firstName,
      p.lastName,
      streetLine,
      addr?.city ?? "",
      addr?.province ?? "",
      addr?.postalCode ?? "",
      p.phoneHome ?? "",
      p.phoneMobile ?? "",
      p.email ?? "",
      r.respondedAt.toISOString().split("T")[0],
    ];
  });

  const csv = [headers, ...rows].map(csvRow).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="volunteers.csv"`,
    },
  });
}

function csvRow(fields: string[]): string {
  return fields.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(",");
}
