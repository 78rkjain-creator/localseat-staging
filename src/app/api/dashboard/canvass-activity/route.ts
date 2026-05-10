import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, checkOrigin } from "@/lib/auth";
import { getRecentCanvassActivity } from "@/lib/dashboard";

export async function GET(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json([], { status: 401 });

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return NextResponse.json([]);

  const entries = await getRecentCanvassActivity(activeCampaignId);
  return NextResponse.json(entries);
}
