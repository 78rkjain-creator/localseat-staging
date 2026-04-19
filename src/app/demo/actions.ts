"use server";

import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { headers } from "next/headers";

interface DemoFormData {
  firstName:    string;
  lastName:     string;
  email:        string;
  phone:        string;
  municipality: string;
  officeType:   string;
}

export async function registerDemo(data: DemoFormData): Promise<{ error?: string }> {
  const { firstName, lastName, email, phone, municipality, officeType } = data;

  if (!firstName.trim() || !lastName.trim() || !email.trim()) {
    return { error: "First name, last name, and email are required." };
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email.trim())) {
    return { error: "Please enter a valid email address." };
  }

  // Resolve client IP for lead context
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? "unknown";

  await db.demoRegistration.create({
    data: {
      firstName:    firstName.trim(),
      lastName:     lastName.trim(),
      email:        email.trim().toLowerCase(),
      phone:        phone.trim() || null,
      municipality: municipality.trim() || null,
      officeType:   officeType || null,
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
      officeType:   officeType || null,
      ip,
    },
  });

  return {};
}
