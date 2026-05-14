import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import {
  sendPaymentWarningEmail,
  sendPaymentSuspendedEmail,
} from "@/lib/email";

/**
 * Daily cron: checks campaigns with paymentStatus=pending and sends
 * warning emails based on how many days since checkout.
 *
 * Day 5: "2 days remaining" warning
 * Day 6: "1 day remaining" warning
 * Day 7: Account suspended
 *
 * curl -H "x-cron-secret: $CRON_SECRET" https://app.localseat.io/api/cron/payment-warnings
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let warned = 0;
  let suspended = 0;

  // Find all campaigns with pending payment
  const pendingCampaigns = await db.campaign.findMany({
    where: {
      paymentStatus: "pending",
      paymentDueDate: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      paymentDueDate: true,
      paymentWarningsSent: true,
      memberships: {
        where: {
          role: { in: ["candidate", "campaign_manager"] },
          deletedAt: null,
        },
        select: {
          user: {
            select: { id: true, email: true, firstName: true },
          },
        },
      },
    },
  });

  for (const campaign of pendingCampaigns) {
    if (!campaign.paymentDueDate) continue;

    const msRemaining = campaign.paymentDueDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

    // Day 7+ (past due): suspend
    if (daysRemaining <= 0) {
      await db.campaign.update({
        where: { id: campaign.id },
        data: {
          paymentStatus: "suspended",
          isActive: false,
          suspendedAt: now,
          paymentWarningsSent: 3,
        },
      });

      for (const m of campaign.memberships) {
        await sendPaymentSuspendedEmail({
          name: m.user.firstName,
          email: m.user.email,
          campaignName: campaign.name,
        });
      }

      await createAuditLog({
        campaignId: campaign.id,
        action: "PAYMENT_SUSPENDED",
        entityType: "campaign",
        entityId: campaign.id,
        details: { daysRemaining, paymentDueDate: campaign.paymentDueDate },
      });

      suspended++;
      continue;
    }

    // Day 6 (1 day remaining): second warning
    if (daysRemaining <= 1 && campaign.paymentWarningsSent < 2) {
      for (const m of campaign.memberships) {
        await sendPaymentWarningEmail({
          name: m.user.firstName,
          email: m.user.email,
          campaignName: campaign.name,
          daysRemaining: 1,
        });
      }

      await db.campaign.update({
        where: { id: campaign.id },
        data: { paymentWarningsSent: 2 },
      });

      await createAuditLog({
        campaignId: campaign.id,
        action: "PAYMENT_WARNING_SENT",
        entityType: "campaign",
        entityId: campaign.id,
        details: { daysRemaining: 1, warningNumber: 2 },
      });

      warned++;
      continue;
    }

    // Day 5 (2 days remaining): first warning
    if (daysRemaining <= 2 && campaign.paymentWarningsSent < 1) {
      for (const m of campaign.memberships) {
        await sendPaymentWarningEmail({
          name: m.user.firstName,
          email: m.user.email,
          campaignName: campaign.name,
          daysRemaining: 2,
        });
      }

      await db.campaign.update({
        where: { id: campaign.id },
        data: { paymentWarningsSent: 1 },
      });

      await createAuditLog({
        campaignId: campaign.id,
        action: "PAYMENT_WARNING_SENT",
        entityType: "campaign",
        entityId: campaign.id,
        details: { daysRemaining: 2, warningNumber: 1 },
      });

      warned++;
    }
  }

  console.log(`[payment-warnings] ${warned} warnings sent, ${suspended} campaigns suspended`);
  return NextResponse.json({ warned, suspended });
}
