export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { rateLimitByKey } from "@/lib/rate-limit";

const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_IP_PER_HOUR = 10;

export async function POST(req: NextRequest) {
  // ── Shared secret check ───────────────────────────────────────────────────
  const secret = req.headers.get("x-webhook-secret");
  if (!process.env.DEMO_WEBHOOK_SECRET || secret !== process.env.DEMO_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── IP-based rate limit ───────────────────────────────────────────────────
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";

  if (!rateLimitByKey(`demo-lead:${ip}`, MAX_PER_IP_PER_HOUR, HOUR_MS)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // ── Parse and validate body ───────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { firstName, lastName, email, phone, municipality, officeType, consented, source } = body as Record<string, string | boolean | undefined>;

  if (
    typeof firstName !== "string" || !firstName.trim() ||
    typeof lastName  !== "string" || !lastName.trim()  ||
    typeof email     !== "string" || !email.trim()     ||
    !consented
  ) {
    return NextResponse.json(
      { error: "firstName, lastName, email, and consented are required" },
      { status: 400 }
    );
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // ── Persist ───────────────────────────────────────────────────────────────
  await db.demoRegistration.create({
    data: {
      firstName:    firstName.trim(),
      lastName:     lastName.trim(),
      email:        email.trim().toLowerCase(),
      phone:        typeof phone === "string" && phone.trim() ? phone.trim() : null,
      municipality: typeof municipality === "string" && municipality.trim() ? municipality.trim() : null,
      officeType:   typeof officeType === "string" && officeType ? officeType : null,
      consented:    Boolean(consented),
      source:       typeof source === "string" && source.trim() ? source.trim() : null,
      ipAddress:    ip,
    },
  });

  await createAuditLog({
    action:     "DEMO_LEAD_REGISTERED",
    entityType: "demo_registration",
    entityId:   email.trim().toLowerCase(),
    details: {
      firstName,
      lastName,
      email:        email.trim().toLowerCase(),
      municipality: municipality ?? null,
      officeType:   officeType   ?? null,
      source:       source       ?? null,
      ip,
    },
  });

  return NextResponse.json({ success: true });
}
