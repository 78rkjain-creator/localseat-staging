import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDailySummary } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaigns = await db.campaign.findMany({
    where: { dailySummaryEnabled: true, dailySummaryEmail: { not: null } },
    select: { id: true },
  });

  const results = await Promise.allSettled(
    campaigns.map((c) => sendDailySummary(c.id))
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ sent, failed });
}
