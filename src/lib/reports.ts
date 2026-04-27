import { db } from "@/lib/db";
import nodemailer from "nodemailer";

// ── Email transport ────────────────────────────────────────────────────────────

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ── Data helpers ───────────────────────────────────────────────────────────────

async function getSummaryData(campaignId: string, sinceDate: Date) {
  const [responses, openFollowUps] = await Promise.all([
    db.canvassResponse.findMany({
      where: {
        person: { campaignId },
        respondedAt: { gte: sinceDate },
      },
      select: { supportLevel: true, personId: true },
    }),
    db.task.count({
      where: {
        campaignId,
        completed: false,
        deletedAt: null,
      },
    }),
  ]);

  const doorsToday = new Set(responses.map((r) => r.personId)).size;

  const supportCounts: Record<string, number> = {};
  for (const r of responses) {
    if (r.supportLevel) {
      supportCounts[r.supportLevel] = (supportCounts[r.supportLevel] ?? 0) + 1;
    }
  }

  return { doorsToday, supportCounts, openFollowUps };
}

// ── HTML email template ────────────────────────────────────────────────────────

function buildEmailHtml(opts: {
  campaignName: string;
  date: string;
  doorsToday: number;
  openFollowUps: number;
  supportCounts: Record<string, number>;
}): string {
  const { campaignName, date, doorsToday, openFollowUps, supportCounts } = opts;

  const supportRows = [
    ["Strong Yes", supportCounts.strong_yes ?? 0, "#10b981"],
    ["Soft Yes", supportCounts.soft_yes ?? 0, "#34d399"],
    ["Undecided", supportCounts.undecided ?? 0, "#f59e0b"],
    ["Soft No", supportCounts.soft_no ?? 0, "#f97316"],
    ["Strong No", supportCounts.strong_no ?? 0, "#ef4444"],
  ] as [string, number, string][];

  const supportRowsHtml = supportRows
    .map(
      ([label, count, color]) => `
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#475569;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle;"></span>
          ${label}
        </td>
        <td style="padding:6px 12px;font-size:13px;color:#0f172a;font-weight:600;text-align:right;">${count}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
    <!-- Header -->
    <div style="background:#f97316;padding:24px 28px;">
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);font-weight:500;">LocalSeat · Daily Summary</p>
      <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#fff;">${campaignName}</h1>
      <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7);">${date}</p>
    </div>

    <!-- Stats row -->
    <div style="display:flex;border-bottom:1px solid #f1f5f9;">
      <div style="flex:1;padding:20px 28px;border-right:1px solid #f1f5f9;">
        <p style="margin:0;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Doors Today</p>
        <p style="margin:6px 0 0;font-size:32px;font-weight:800;color:#0f172a;">${doorsToday}</p>
      </div>
      <div style="flex:1;padding:20px 28px;">
        <p style="margin:0;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Open Follow-ups</p>
        <p style="margin:6px 0 0;font-size:32px;font-weight:800;color:#0f172a;">${openFollowUps}</p>
      </div>
    </div>

    <!-- Support breakdown -->
    <div style="padding:20px 28px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Today's Support Breakdown</p>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${supportRowsHtml}</tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;border-top:1px solid #f1f5f9;background:#f8fafc;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">Sent by LocalSeat · Manage your report settings in Campaign Settings → Email Reports</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function sendDailySummary(campaignId: string): Promise<void> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      name: true,
      dailySummaryEnabled: true,
      dailySummaryEmail: true,
    },
  });

  if (!campaign?.dailySummaryEnabled || !campaign.dailySummaryEmail) return;

  const now = new Date();
  const sinceDate = new Date(now);
  sinceDate.setHours(0, 0, 0, 0);

  const { doorsToday, supportCounts, openFollowUps } = await getSummaryData(
    campaignId,
    sinceDate
  );

  const dateStr = now.toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const html = buildEmailHtml({
    campaignName: campaign.name,
    date: dateStr,
    doorsToday,
    openFollowUps,
    supportCounts,
  });

  const transport = createTransport();

  await transport.sendMail({
    from: `LocalSeat <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: campaign.dailySummaryEmail,
    subject: `Daily Summary — ${campaign.name} — ${dateStr}`,
    html,
  });
}
