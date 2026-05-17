import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";

/**
 * Backup alert endpoint
 *
 * Called by the VPS backup script after every run.
 * Records the run in BackupRun table.
 * Sends an email to rahul@localseat.io on failure.
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

  // Always try to record the run, even on success - this powers the dashboard.
  // DB failure is logged but not propagated; the backup script has done its job.
  let dbWritten = false;
  try {
    await db.backupRun.create({
      data: {
        tier: typeof tier === "string" ? tier : "unknown",
        filename: typeof filename === "string" ? filename : "unknown",
        success,
        sizeBytes:
          typeof sizeBytes === "number" && sizeBytes > 0
            ? BigInt(Math.floor(sizeBytes))
            : null,
        durationMs:
          typeof durationMs === "number" && durationMs >= 0
            ? Math.floor(durationMs)
            : null,
        errorCode:
          typeof errorCode === "number" && errorCode !== 0
            ? Math.floor(errorCode)
            : null,
        errorMessage:
          typeof errorMessage === "string" && errorMessage.length > 0
            ? errorMessage.slice(0, 4000)
            : null,
        logTail:
          typeof logTail === "string" && logTail.length > 0
            ? logTail.slice(0, 16000)
            : null,
      },
    });
    dbWritten = true;
  } catch (err) {
    console.error("[backup-alert] DB write failed", err);
    // continue - email path is still important even if DB is down
  }

  // Success path: log and return. No email.
  if (success) {
    console.log(
      `[backup-alert] success tier=${tier} file=${filename} size=${sizeBytes} duration=${durationMs}ms dbWritten=${dbWritten}`,
    );
    return NextResponse.json({ received: true, dbWritten });
  }

  // Failure path: send email.
  console.error(
    `[backup-alert] FAILURE tier=${tier} file=${filename} code=${errorCode} message=${errorMessage}`,
  );

  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[backup-alert] cannot send email - missing env: ${missing.join(", ")}`);
    return NextResponse.json(
      { received: true, dbWritten, emailSent: false, reason: "smtp-not-configured" },
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

  const from = process.env.SMTP_USER ?? "info@localseat.io";

  const subject = `[LocalSeat] Backup FAILED - ${tier ?? "unknown"} - ${new Date().toISOString().slice(0, 16)}`;

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
      { received: true, dbWritten, emailSent: false, reason: "send-failed" },
      { status: 200 },
    );
  }

  return NextResponse.json({ received: true, dbWritten, emailSent: true });
}
