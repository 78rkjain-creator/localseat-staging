import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Deletes PendingCampaign records that have expired (48h after creation
 * without completing payment). Run daily via cron.
 *
 * curl -H "x-cron-secret: $CRON_SECRET" https://your-domain/api/cron/cleanup-pending
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db.pendingCampaign.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  console.log(`[cleanup-pending] Deleted ${result.count} expired pending campaigns`);

  return NextResponse.json({ deleted: result.count });
}
