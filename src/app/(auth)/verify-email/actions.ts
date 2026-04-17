"use server";

import { db } from "@/lib/db";
import { verifyToken } from "@/lib/verification";
import { sendWelcomeEmail } from "@/lib/email";
import type { VerifyTokenResult } from "@/lib/verification";

export type VerifyActionResult =
  | { success: true }
  | { success: false; error: "not_found" | "expired" | "already_verified" };

/**
 * Verifies the token, sends the welcome email on success,
 * and returns a typed result for the client to act on.
 */
export async function verifyTokenAction(token: string): Promise<VerifyActionResult> {
  const result: VerifyTokenResult = await verifyToken(token);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Look up any campaign membership so the welcome email can include it
  const user = await db.user.findUnique({
    where: { id: result.user.id },
    include: {
      memberships: {
        where: { deletedAt: null },
        include: { campaign: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  void sendWelcomeEmail({
    name: `${result.user.firstName} ${result.user.lastName}`,
    email: result.user.email,
    campaignName: user?.memberships[0]?.campaign.name,
    role: user?.memberships[0]?.role,
  });

  return { success: true };
}
