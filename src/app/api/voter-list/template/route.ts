export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const BASE_HEADERS =
  "FirstName,LastName,StreetNumber,StreetName,UnitNumber,City,Province,PostalCode,PhoneHome,PhoneMobile,Email,BirthYear,PollNumber";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { activeCampaignId } = session.user;

  type CampaignCustomField = { id: string; label: string };
  let customFieldHeaders = "";
  if (activeCampaignId) {
    const campaign = await db.campaign.findUnique({
      where: { id: activeCampaignId },
      select: { customFields: true },
    });
    const fields = (campaign?.customFields as CampaignCustomField[] | null) ?? [];
    if (fields.length > 0) {
      // Wrap each label in quotes to handle commas or spaces safely
      customFieldHeaders = "," + fields.map((f) => `"${f.label.replace(/"/g, '""')}"`).join(",");
    }
  }

  const headers = BASE_HEADERS + customFieldHeaders + "\r\n";

  return new NextResponse(headers, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="voter-list-template.csv"',
    },
  });
}
