import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json([], { status: 401 });

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return NextResponse.json([]);

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const addresses = await db.address.findMany({
    where: {
      campaignId: activeCampaignId,
      deletedAt: null,
      OR: [
        { streetName: { contains: q, mode: "insensitive" } },
        { streetNumber: { contains: q, mode: "insensitive" } },
        { postalCode: { contains: q.replace(/\s/g, ""), mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      streetNumber: true,
      streetName: true,
      unitNumber: true,
      city: true,
      province: true,
      postalCode: true,
    },
    orderBy: [{ streetName: "asc" }, { streetNumber: "asc" }],
    take: 10,
  });

  return NextResponse.json(addresses);
}
