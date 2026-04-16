"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSuperAdmin, isSuperUser } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ── Auth guards ───────────────────────────────────────────────────────────────

async function requirePlatformAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  if (!isSuperAdmin(session.user.platformRole)) {
    return { error: "Platform admin access required." } as const;
  }
  return { session } as const;
}

async function requireSuperUser() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  if (!isSuperUser(session.user.platformRole)) {
    return { error: "Super user access required." } as const;
  }
  return { session } as const;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  // Unambiguous character set — excludes 0/O, 1/l/I
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function deactivateUser(
  userId: string
): Promise<{ error?: string }> {
  const auth = await requirePlatformAdmin();
  if ("error" in auth) return auth;

  await db.user.update({
    where: { id: userId },
    data: { isActive: false },
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return {};
}

export async function reactivateUser(
  userId: string
): Promise<{ error?: string }> {
  const auth = await requirePlatformAdmin();
  if ("error" in auth) return auth;

  await db.user.update({
    where: { id: userId },
    data: { isActive: true },
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return {};
}

export async function assignSuperAdmin(
  userId: string
): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  await db.user.update({
    where: { id: userId },
    data: { platformRole: "super_admin" },
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return {};
}

export async function revokePlatformRole(
  userId: string
): Promise<{ error?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  // Cannot revoke own role
  if (auth.session.user.id === userId) {
    return { error: "You cannot revoke your own platform role." };
  }

  await db.user.update({
    where: { id: userId },
    data: { platformRole: null },
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return {};
}

export async function resetUserPassword(
  userId: string
): Promise<{ error?: string; tempPassword?: string }> {
  const auth = await requireSuperUser();
  if ("error" in auth) return auth;

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { tempPassword };
}
