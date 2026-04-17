import { db } from "@/lib/db";

/**
 * Write a structured audit log entry.
 *
 * - campaignId  optional — omit for platform-level admin actions
 * - userId      optional — omit for unauthenticated events (e.g. failed login)
 * - entityId    optional — defaults to "" when the entity has no natural ID
 * - details     stored in the `after` Json column; `before` is left null
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
    await db.auditLog.create({
      data: {
        campaignId: params.campaignId ?? null,
        userId:     params.userId     ?? null,
        action:     params.action,
        entityType: params.entityType,
        entityId:   params.entityId   ?? "",
        after:      params.details    ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log entry:", err);
  }
}
