import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * Internal endpoint used by the proxy's in-memory cache to check the
 * DB-driven maintenance flag without importing Prisma into middleware.
 * No auth required — it returns nothing sensitive.
 */
export async function GET() {
  if (process.env.MAINTENANCE_MODE === "true") {
    return NextResponse.json({ maintenance: true });
  }
  try {
    const row = await db.platformSettings.findUnique({ where: { key: "maintenance_mode" } });
    return NextResponse.json({ maintenance: row?.value === "true" });
  } catch {
    return NextResponse.json({ maintenance: false });
  }
}
