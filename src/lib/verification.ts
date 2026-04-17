import crypto from "crypto";
import { db } from "@/lib/db";

const TOKEN_EXPIRY_DAYS = 14;

// ── Token generation ──────────────────────────────────────────────────────────

/**
 * Creates a crypto-random verification token, stores it on the user with a
 * 14-day expiry, and returns the raw token string to include in the email.
 */
export async function generateVerificationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + TOKEN_EXPIRY_DAYS);

  await db.user.update({
    where: { id: userId },
    data: {
      verificationToken: token,
      verificationTokenExpiry: expiry,
    },
  });

  return token;
}

// ── Token verification ────────────────────────────────────────────────────────

export type VerifyTokenResult =
  | { success: true; user: { id: string; firstName: string; lastName: string; email: string } }
  | { success: false; error: "not_found" | "expired" | "already_verified" };

/**
 * Finds the user by token, checks expiry, marks emailVerified, clears token
 * fields, and returns the user. Returns a typed error on failure.
 */
export async function verifyToken(token: string): Promise<VerifyTokenResult> {
  const user = await db.user.findUnique({
    where: { verificationToken: token },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      emailVerified: true,
      verificationTokenExpiry: true,
    },
  });

  if (!user) return { success: false, error: "not_found" };

  if (user.emailVerified) return { success: false, error: "already_verified" };

  if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
    return { success: false, error: "expired" };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      verificationToken: null,
      verificationTokenExpiry: null,
    },
  });

  return {
    success: true,
    user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
  };
}

// ── State helpers ─────────────────────────────────────────────────────────────

export function isVerified(user: { emailVerified: Date | null }): boolean {
  return user.emailVerified !== null;
}

export function isExpired(user: {
  emailVerified: Date | null;
  verificationTokenExpiry: Date | null;
}): boolean {
  if (user.emailVerified) return false;
  if (!user.verificationTokenExpiry) return false;
  return user.verificationTokenExpiry < new Date();
}
