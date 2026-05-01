import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Write a structured audit log entry.
 *
 * - campaignId  optional — omit for platform-level admin actions
 * - userId      optional — omit for unauthenticated events (e.g. failed login)
 * - entityId    optional — defaults to "" when the entity has no natural ID
 * - details     stored in the `after` Json column; `before` is left null
 *
 * Automatically adds `supportAccess: true` to the stored payload when the
 * caller is operating in full support mode, so these entries are identifiable
 * in the audit log.
 *
 * Never throws — all errors are swallowed so a logging failure can never
 * break a real user-facing operation.
 */
export async function createAuditLog(params: {
  campaignId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    let details = params.details;

    // Detect full support mode sessions and tag the entry
    try {
      const session = await getServerSession(authOptions);
      if (session?.user.supportMode === "full") {
        details = { ...details, supportAccess: true };
      }
    } catch {
      // session read failure should never block the log write
    }

    await db.auditLog.create({
      data: {
        campaignId: params.campaignId ?? null,
        userId:     params.userId     ?? null,
        action:     params.action,
        entityType: params.entityType,
        entityId:   params.entityId   ?? "",
        after:      details !== undefined
                      ? (details as unknown as Prisma.InputJsonValue)
                      : Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log entry:", err);
  }
}
