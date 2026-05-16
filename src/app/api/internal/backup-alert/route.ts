import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * Backup alert endpoint
 *
 * Called by the VPS backup script after every run.
 * Sends an email to rahul@localseat.io on failure.
 * Success calls are logged silently (the dashboard will surface success state later).
 *
 * Auth: x-cron-secret header must match process.env.CRON_SECRET
 *
 * Body:
 *   {
 *     success: boolean,
 *     tier: "intraday" | "daily" | "weekly" | "monthly",
 *     filename: string,
 *     sizeBytes?: number,
 *     durationMs?: number,
 *     errorCode?: number,
 *     errorMessage?: string,
 *     logTail?: string
 *   }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    success,
    tier,
    filename,
    sizeBytes,
    durationMs,
    errorCode,
    errorMessage,
    logTail,
  } = body ?? {};

  if (typeof success !== "boolean") {
    return NextResponse.json({ error: "Missing success field" }, { status: 400 });
  }

  // Success: log to server console (will be wired into health dashboard later) and return OK.
  // We do NOT email on success to avoid alert fatigue.
  if (success) {
    console.log(
      `[backup-alert] success tier=${tier} file=${filename} size=${sizeBytes} duration=${durationMs}ms`,
    );
    return NextResponse.json({ received: true });
  }

  // Failure: send email
  console.error(
    `[backup-alert] FAILURE tier=${tier} file=${filename} code=${errorCode} message=${errorMessage}`,
  );

  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[backup-alert] cannot send email — missing env: ${missing.join(", ")}`);
    return NextResponse.json(
      { received: true, emailSent: false, reason: "smtp-not-configured" },
      { status: 200 },
    );
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT!, 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });

  const from =
    process.env.SMTP_FROM_APPROVALS ?? process.env.SMTP_USER ?? "alerts@localseat.io";

  const subject = `[LocalSeat] Backup FAILED — ${tier ?? "unknown"} — ${new Date().toISOString().slice(0, 16)}`;

  const text = [
    `LocalSeat backup failed.`,
    ``,
    `Tier:     ${tier ?? "unknown"}`,
    `File:     ${filename ?? "unknown"}`,
    `Code:     ${errorCode ?? "unknown"}`,
    `Message:  ${errorMessage ?? "unknown"}`,
    ``,
    `Last log lines:`,
    `--------------------------------------------------------`,
    logTail ?? "(no log provided)",
    `--------------------------------------------------------`,
    ``,
    `Investigate on the VPS:`,
    `  ssh root@2.24.212.25`,
    `  tail -100 /var/log/localseat/backups.log`,
  ].join("\n");

  try {
    await transporter.sendMail({
      from: `"LocalSeat Alerts" <${from}>`,
      to: "rahul@localseat.io",
      subject,
      text,
    });
  } catch (err) {
    console.error("[backup-alert] sendMail failed", err);
    return NextResponse.json(
      { received: true, emailSent: false, reason: "send-failed" },
      { status: 200 },
    );
  }

  return NextResponse.json({ received: true, emailSent: true });
}
