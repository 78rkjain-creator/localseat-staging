"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ error?: string; success?: boolean }> {
  if (!token) return { error: "Invalid reset link." };
  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const user = await db.user.findUnique({
    where: { passwordResetToken: token },
    select: { id: true, passwordResetTokenExpiry: true },
  });

  if (!user) return { error: "Invalid or expired reset link." };

  if (!user.passwordResetTokenExpiry || user.passwordResetTokenExpiry < new Date()) {
    return { error: "This reset link has expired. Please request a new one." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetTokenExpiry: null,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "user",
    entityId: user.id,
  });

  return { success: true };
}
