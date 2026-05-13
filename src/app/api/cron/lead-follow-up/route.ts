import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendLeadFollowUpEmail, sendLeadFollowUpSummary } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Daily cron job: sends a follow-up email to leads who registered yesterday
 * and haven't been emailed yet. Sends a summary to info@localseat.io.
 *
 * Call via: GET /api/cron/lead-follow-up
 * Auth:    x-cron-secret header must match CRON_SECRET env var
 *
 * Schedule recommendation: run once daily at 9:00 AM ET
 * e.g. crontab: 0 13 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://app.localseat.io/api/cron/lead-follow-up
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find leads created yesterday that haven't been emailed
  const now = new Date();
  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);

  const yesterdayEnd = new Date(now);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const leads = await db.demoRegistration.findMany({
    where: {
      createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
      emailedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (leads.length === 0) {
    // Still send summary so you know the job ran
    await sendLeadFollowUpSummary({ sent: [], failed: [], date: yesterdayStart });
    return NextResponse.json({ sent: 0, failed: 0, skipped: 0, message: "No new leads from yesterday" });
  }

  // Group by email — only send one email per unique address
  const byEmail = new Map<string, typeof leads[0]>();
  for (const lead of leads) {
    const key = lead.email.toLowerCase();
    if (!byEmail.has(key)) {
      byEmail.set(key, lead);
    }
  }

  const sentList: { name: string; email: string }[] = [];
  const failedList: { name: string; email: string }[] = [];

  for (const [email, lead] of byEmail) {
    const fullName = `${lead.firstName} ${lead.lastName}`;
    const success = await sendLeadFollowUpEmail({
      firstName: lead.firstName,
      email,
    });

    if (success) {
      await db.demoRegistration.updateMany({
        where: { email },
        data: { emailedAt: new Date() },
      });
      sentList.push({ name: fullName, email });
    } else {
      failedList.push({ name: fullName, email });
    }
  }

  // Send summary to info@localseat.io
  await sendLeadFollowUpSummary({ sent: sentList, failed: failedList, date: yesterdayStart });

  console.log(`[cron/lead-follow-up] Processed ${byEmail.size} leads: ${sentList.length} sent, ${failedList.length} failed`);

  return NextResponse.json({ sent: sentList.length, failed: failedList.length, total: byEmail.size });
}
