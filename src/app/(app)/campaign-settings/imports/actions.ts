"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canReviewDataImports } from "@/lib/permissions";
import { importVoterRows } from "@/app/(app)/import/voters/actions";
import type { Role } from "@/types";
import type { VoterCsvRow } from "@/app/(app)/import/voters/actions";

async function requireImportReviewer() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canReviewDataImports(activeRole as Role)) {
    return { error: "You don't have permission to review imports." } as const;
  }
  return { session, campaignId: activeCampaignId } as const;
}

export async function approveAndMergeImport(importId: string): Promise<{ error?: string }> {
  const auth = await requireImportReviewer();
  if ("error" in auth) return auth;
  const { campaignId, session } = auth;

  const dataImport = await db.dataImport.findFirst({
    where: { id: importId, campaignId, status: "pending" },
  });
  if (!dataImport) return { error: "Import not found or already processed." };

  // Mark as processing
  await db.dataImport.update({
    where: { id: importId },
    data: {
      status: "processing",
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });

  try {
    const rows = dataImport.rawData as unknown as VoterCsvRow[];
    const result = await importVoterRows(rows, "list", dataImport.fileName);

    if (result.error) {
      await db.dataImport.update({
        where: { id: importId },
        data: { status: "failed", reviewNote: result.error },
      });
      return { error: result.error };
    }

    await db.dataImport.update({
      where: { id: importId },
      data: { status: "completed", completedAt: new Date() },
    });
  } catch (err) {
    console.error("[approveAndMergeImport] failed:", err);
    await db.dataImport.update({
      where: { id: importId },
      data: { status: "failed" },
    });
    return { error: "Import merge failed. Check server logs." };
  }

  revalidatePath("/campaign-settings/imports");
  redirect("/campaign-settings/imports");
}

export async function rejectImport(
  importId: string,
  reviewNote: string
): Promise<{ error?: string }> {
  const auth = await requireImportReviewer();
  if ("error" in auth) return auth;
  const { campaignId, session } = auth;

  if (!reviewNote.trim() || reviewNote.trim().length < 10) {
    return { error: "Rejection reason must be at least 10 characters." };
  }

  const dataImport = await db.dataImport.findFirst({
    where: { id: importId, campaignId, status: "pending" },
  });
  if (!dataImport) return { error: "Import not found or already processed." };

  await db.dataImport.update({
    where: { id: importId },
    data: {
      status: "rejected",
      reviewNote: reviewNote.trim(),
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/campaign-settings/imports");
  redirect("/campaign-settings/imports");
}
