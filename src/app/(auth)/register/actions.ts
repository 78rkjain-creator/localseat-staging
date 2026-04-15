"use server";

import bcrypt from "bcryptjs";
import { signIn } from "next-auth/react";
import { db } from "@/lib/db";
import { sanitizeText, sanitizeEmail, sanitizePhone } from "@/lib/sanitize";

interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneHome?: string;
  phoneMobile?: string;
  password: string;
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

  if (!firstName || !lastName || !email || !password) {
    return { error: "All required fields must be filled in." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: {
      email,
      firstName,
      lastName,
      passwordHash,
      ...(phoneHome ? { phoneHome } : {}),
      ...(phoneMobile ? { phoneMobile } : {}),
    },
  });

  return null;
}
