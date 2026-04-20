"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { platformRole } = session.user;
  if (platformRole !== "super_user" && platformRole !== "super_admin") {
    return { error: "Forbidden." };
  }

  if (!currentPassword || !newPassword) {
    return { error: "All fields are required." };
  }

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { id: true, passwordHash: true },
  });

  if (!user) return { error: "User not found." };

  const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentOk) return { error: "Current password is incorrect." };

  const newHash = await bcrypt.hash(newPassword, 12);

  await db.user.update({
    where: { id: user.id },
    data:  { passwordHash: newHash },
  });

  await createAuditLog({
    userId:     user.id,
    action:     "PASSWORD_CHANGED",
    entityType: "user",
    entityId:   user.id,
    details:    { method: "admin_self_service" },
  });

  return {};
}
