"use server";

import { db } from "@/lib/db";
import { generateVerificationToken, isExpired } from "@/lib/verification";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimitByKey } from "@/lib/rate-limit";

const RESEND_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RESEND_MAX = 3;

export type ResendResult =
  | { success: true }
  | { error: "expired" | "general" };

export async function resendVerificationEmail(email: string): Promise<ResendResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!rateLimitByKey(`resend:${normalizedEmail}`, RESEND_MAX, RESEND_WINDOW_MS)) {
    return { success: true }; // Silently succeed — don't reveal rate limiting to potential enumerators
  }

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      emailVerified: true,
      verificationTokenExpiry: true,
      deletedAt: true,
      isActive: true,
    },
  });

  // Don't reveal whether an account exists for a given email
  if (!user || user.deletedAt) return { success: true };

  // Already verified — silently succeed (client redirects to login)
  if (user.emailVerified) return { success: true };

  if (isExpired(user)) {
    return { error: "expired" };
  }

  // Regenerate token — resets the 14-day window from now
  const token = await generateVerificationToken(user.id);
  void sendVerificationEmail({
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    token,
  });

  return { success: true };
}
