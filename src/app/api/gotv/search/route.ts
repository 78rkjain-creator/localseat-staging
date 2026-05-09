import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchForPollStrike } from "@/lib/gotv";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return NextResponse.json({ error: "No campaign" }, { status: 400 });

  const query = req.nextUrl.searchParams.get("q") ?? "";
  if (!query.trim()) return NextResponse.json({ results: [] });

  const people = await searchForPollStrike(activeCampaignId, query, 20);

  const results = people.map((p) => {
    const addr = p.household?.address;
    const addressStr = addr
      ? [addr.unitNumber, addr.streetNumber, addr.streetName].filter(Boolean).join(" ")
      : null;
    const strike = p.pollStrikes[0] ?? null;

    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      supportLevel: p.supportLevel,
      address: addressStr,
      hasVoted: !!strike,
      strikeType: strike?.strikeType ?? null,
      struckAt: strike?.struckAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ results });
}
