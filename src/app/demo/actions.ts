"use server";

import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { rateLimitByKey } from "@/lib/rate-limit";
import { headers } from "next/headers";

interface DemoFormData {
  firstName:    string;
  lastName:     string;
  email:        string;
  phone:        string;
  municipality: string;
  officeType:   string;
  consented:    boolean;
}

export async function registerDemo(data: DemoFormData): Promise<{ error?: string }> {
  const { firstName, lastName, email, phone, municipality, officeType, consented } = data;

  if (!firstName.trim() || !lastName.trim() || !email.trim()) {
    return { error: "First name, last name, and email are required." };
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email.trim())) {
    return { error: "Please enter a valid email address." };
  }

  if (!consented) {
    return { error: "Please check the consent box to continue." };
  }

  // Resolve client IP for rate limiting and lead context
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? "unknown";

  if (!rateLimitByKey(`demo-register:${ip}`, 10, 60 * 60 * 1000)) {
    return { error: "Too many requests — please try again later." };
  }

  const source = "demo.localseat.io";

  // Save locally (demo database)
  await db.demoRegistration.create({
    data: {
      firstName:    firstName.trim(),
      lastName:     lastName.trim(),
      email:        email.trim().toLowerCase(),
      phone:        phone.trim() || null,
      municipality: municipality.trim() || null,
      officeType:   officeType || null,
      consented,
      source,
      ipAddress:    ip,
    },
  });

  await createAuditLog({
    action:     "DEMO_STARTED",
    entityType: "demo_registration",
    entityId:   email.trim().toLowerCase(),
    details: {
      firstName,
      lastName,
      email:        email.trim().toLowerCase(),
      municipality: municipality || null,
      officeType:   officeType   || null,
      consented,
      source,
      ip,
      loginAs:      "demo@localseat.io",
    },
  });

  // Fire webhook to production — fail silently so demo always works
  try {
    const productionUrl = process.env.PRODUCTION_API_URL;
    const webhookSecret = process.env.DEMO_WEBHOOK_SECRET;

    if (productionUrl && webhookSecret) {
      const res = await fetch(`${productionUrl}/api/demo-leads`, {
        method:  "POST",
        headers: {
          "Content-Type":    "application/json",
          "x-webhook-secret": webhookSecret,
        },
        body: JSON.stringify({
          firstName:    firstName.trim(),
          lastName:     lastName.trim(),
          email:        email.trim().toLowerCase(),
          phone:        phone.trim() || null,
          municipality: municipality.trim() || null,
          officeType:   officeType || null,
          consented,
          source,
        }),
        // Don't hold up the response longer than 5 seconds
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        console.error("[demo-webhook] Production webhook returned", res.status);
      }
    }
  } catch (err) {
    console.error("[demo-webhook] Failed to reach production webhook:", err);
  }

  return {};
}
