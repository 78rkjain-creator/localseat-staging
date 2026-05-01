import { db } from "@/lib/db";

/**
 * Returns true when the platform is in maintenance mode.
 * ENV var takes precedence (hard lockout for deploys); DB flag is for
 * admin-panel-toggled maintenance without a redeploy.
 *
 * Use this in server components and server actions.
 * The proxy uses its own lightweight cached fetch instead of this helper
 * to avoid importing Prisma into middleware.
 */
export async function isMaintenanceMode(): Promise<boolean> {
  if (process.env.MAINTENANCE_MODE === "true") return true;
  const row = await db.platformSettings.findUnique({ where: { key: "maintenance_mode" } });
  return row?.value === "true";
}
