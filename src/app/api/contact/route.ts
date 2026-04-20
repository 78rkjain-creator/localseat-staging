export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { rateLimitByKey } from "@/lib/rate-limit";
import { sendContactNotificationEmail } from "@/lib/email";

const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_IP_PER_HOUR = 10;

export async function POST(req: NextRequest) {
  // ── IP-based rate limit ───────────────────────────────────────────────────
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";

  if (!rateLimitByKey(`contact:${ip}`, MAX_PER_IP_PER_HOUR, HOUR_MS)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // ── Parse and validate body ───────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { firstName, lastName, email, topic, message } = body as Record<string, string | undefined>;

  if (
    typeof firstName !== "string" || !firstName.trim() ||
    typeof lastName  !== "string" || !lastName.trim()  ||
    typeof email     !== "string" || !email.trim()     ||
    typeof message   !== "string" || !message.trim()
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  await db.contactSubmission.create({
    data: {
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email.trim().toLowerCase(),
      topic:     typeof topic === "string" && topic.trim() ? topic.trim() : null,
      message:   message.trim(),
      ipAddress: ip,
    },
  });

  // ── Notify (fire-and-forget) ──────────────────────────────────────────────
  void sendContactNotificationEmail({
    firstName: firstName.trim(),
    lastName:  lastName.trim(),
    email:     email.trim().toLowerCase(),
    topic:     typeof topic === "string" && topic.trim() ? topic.trim() : undefined,
    message:   message.trim(),
  });

  // ── Audit log ─────────────────────────────────────────────────────────────
  await createAuditLog({
    action:     "CONTACT_FORM_SUBMITTED",
    entityType: "contact_submission",
    entityId:   email.trim().toLowerCase(),
    details: {
      email: email.trim().toLowerCase(),
      topic: topic ?? null,
    },
  });

  return NextResponse.json({ success: true });
}

export async function GET()    { return NextResponse.json({ error: "Method not allowed" }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: "Method not allowed" }, { status: 405 }); }
export async function PATCH()  { return NextResponse.json({ error: "Method not allowed" }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: "Method not allowed" }, { status: 405 }); }
