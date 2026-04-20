"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

// ── Auth guard ─────────────────────────────────────────────────────────────

async function requireSuperAccess() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");
  const role = session.user.platformRole;
  if (role !== "super_user" && role !== "super_admin") throw new Error("Forbidden");
  return { user: session.user, isSuperUser: role === "super_user" };
}

// ── Get all settings ───────────────────────────────────────────────────────

export async function getPlatformSettings(): Promise<Record<string, string>> {
  await requireSuperAccess();
  const rows = await db.platformSettings.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ── Update settings ────────────────────────────────────────────────────────

export async function updatePlatformSettings(
  updates: Record<string, string>,
): Promise<{ error?: string }> {
  let auth: Awaited<ReturnType<typeof requireSuperAccess>>;
  try {
    auth = await requireSuperAccess();
  } catch {
    return { error: "Forbidden." };
  }

  if (!auth.isSuperUser) {
    return { error: "Only super_user accounts can save platform settings." };
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) return {};

  // Capture old values for audit diff
  const existing = await db.platformSettings.findMany({
    where: { key: { in: keys } },
  });
  const oldValues = Object.fromEntries(existing.map((r) => [r.key, r.value]));

  // Upsert each key/value pair
  await Promise.all(
    keys.map((key) =>
      db.platformSettings.upsert({
        where: { key },
        create: { key, value: updates[key], updatedBy: auth.user.id },
        update: { value: updates[key], updatedBy: auth.user.id },
      }),
    ),
  );

  // Build audit diff: only include keys that actually changed
  const changed: Record<string, { from: string | null; to: string }> = {};
  for (const key of keys) {
    const prev = oldValues[key] ?? null;
    if (prev !== updates[key]) {
      changed[key] = { from: prev, to: updates[key] };
    }
  }

  if (Object.keys(changed).length > 0) {
    await createAuditLog({
      userId:     auth.user.id,
      action:     "PLATFORM_SETTINGS_UPDATED",
      entityType: "platform_settings",
      details:    { changed },
    });
  }

  return {};
}
