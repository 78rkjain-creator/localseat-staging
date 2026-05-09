import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return NextResponse.json({ error: "No campaign" }, { status: 400 });

  const body = await req.json();
  const { personId } = body;

  if (!personId) return NextResponse.json({ error: "Missing personId" }, { status: 400 });

  // Verify person belongs to campaign
  const person = await db.person.findFirst({
    where: { id: personId, campaignId: activeCampaignId, deletedAt: null },
    select: { id: true },
  });

  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  await db.person.update({
    where: { id: personId },
    data: { needsRide: true },
  });

  return NextResponse.json({ ok: true });
}
