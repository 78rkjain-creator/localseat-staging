"use server";

import bcrypt from "bcryptjs";
import { signIn } from "next-auth/react";
import { db } from "@/lib/db";

interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

// Note: signIn from next-auth/react cannot be called in a server action.
// This action creates the user and returns success; the client calls signIn.
export async function register(input: RegisterInput): Promise<{ error?: string } | null> {
  const email = input.email.toLowerCase().trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const phone = input.phone?.trim() || null;
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
      ...(phone ? { phone } : {}),
    },
  });

  return null;
}
