"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { sanitizeText, sanitizeEmail, sanitizePhone } from "@/lib/sanitize";
import { generateVerificationToken } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";
import { createAuditLog } from "@/lib/audit";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneHome?: string;
  phoneMobile?: string;
  password: string;
  termsSignedName: string;
}

// Note: signIn from next-auth/react cannot be called in a server action.
// This action creates the user and returns success; the client calls signIn.
export async function register(input: RegisterInput): Promise<{ error?: string } | null> {
  const email = sanitizeEmail(input.email);
  const firstName = sanitizeText(input.firstName, 100);
  const lastName = sanitizeText(input.lastName, 100);
  const phoneHome = sanitizePhone(input.phoneHome);
  const phoneMobile = sanitizePhone(input.phoneMobile);
  const password = input.password;
  const termsSignedName = sanitizeText(input.termsSignedName, 200);

  if (!firstName || !lastName || !email || !password) {
    return { error: "All required fields must be filled in." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  if (!termsSignedName) {
    return { error: "You must provide your electronic signature to accept the Terms and Conditions." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const termsAcceptedAt = new Date();

  const user = await db.user.create({
    data: {
      email,
      firstName,
      lastName,
      passwordHash,
      ...(phoneHome ? { phoneHome } : {}),
      ...(phoneMobile ? { phoneMobile } : {}),
      termsAcceptedAt,
      termsSignedName,
      termsVersion: CURRENT_TERMS_VERSION,
    },
  });

  // Resolve client IP for the audit log
  const headersList = await headers();
  const forwarded = headersList.get("x-forwarded-for");
  const ip =
    (forwarded ? forwarded.split(",")[0].trim() : null) ??
    headersList.get("x-real-ip") ??
    "unknown";

  await createAuditLog({
    userId: user.id,
    action: "TERMS_ACCEPTED",
    entityType: "user",
    entityId: user.id,
    details: {
      termsVersion: CURRENT_TERMS_VERSION,
      termsSignedName,
      termsAcceptedAt: termsAcceptedAt.toISOString(),
      ip,
    },
  });

  // Generate verification token and send email — welcome email is sent after verification
  const token = await generateVerificationToken(user.id);
  void sendVerificationEmail({ name: `${firstName} ${lastName}`, email, token });

  return null;
}
