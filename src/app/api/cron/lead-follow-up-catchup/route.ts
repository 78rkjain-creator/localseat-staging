import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendLeadFollowUpEmail, sendLeadFollowUpSummary } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * ONE-TIME catchup: sends follow-up emails to ALL leads that haven't been
 * emailed yet, regardless of when they registered.
 *
 * Call via: GET /api/cron/lead-follow-up-catchup
 * Auth:    x-cron-secret header must match CRON_SECRET env var
 *
 * DELETE THIS ROUTE after running it once.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leads = await db.demoRegistration.findMany({
    where: { emailedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (leads.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, message: "No un-emailed leads found" });
  }

  // Group by email
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

  // Send summary
  await sendLeadFollowUpSummary({ sent: sentList, failed: failedList, date: new Date() });

  console.log(`[cron/lead-follow-up-catchup] Catchup complete: ${sentList.length} sent, ${failedList.length} failed`);

  return NextResponse.json({ sent: sentList.length, failed: failedList.length, total: byEmail.size });
}
