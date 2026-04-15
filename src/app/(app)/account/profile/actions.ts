"use server";

import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sanitizeText, sanitizeEmail, sanitizePhone } from "@/lib/sanitize";

export async function updateProfile(input: {
  firstName: string;
  lastName: string;
  email: string;
  phoneHome: string;
  phoneMobile: string;
}): Promise<{ error?: string; success?: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated." };

  const firstName = sanitizeText(input.firstName, 100);
  const lastName = sanitizeText(input.lastName, 100);
  const email = sanitizeEmail(input.email);
  const phoneHome = sanitizePhone(input.phoneHome);
  const phoneMobile = sanitizePhone(input.phoneMobile);

  if (!firstName || !lastName || !email) {
    return { error: "First name, last name, and email are required." };
  }

  // Check email uniqueness if changed
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.id !== session.user.id) {
    return { error: "That email address is already in use." };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { firstName, lastName, email, phoneHome, phoneMobile },
  });

  return { success: true };
}

export async function updatePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ error?: string; success?: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated." };

  if (input.newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "User not found." };

  const match = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!match) return { error: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await db.user.update({ where: { id: session.user.id }, data: { passwordHash } });

  return { success: true };
}
