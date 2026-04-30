"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function createFieldMessage(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (
    activeRole !== "candidate" &&
    activeRole !== "campaign_manager" &&
    activeRole !== "data_manager" &&
    activeRole !== "field_organizer"
  ) {
    return;
  }

  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const content = (formData.get("content") as string | null)?.trim() ?? "";
  const priority = formData.get("priority") === "urgent" ? "urgent" : "normal";
  const expiresAtRaw = formData.get("expiresAt") as string | null;

  if (!title || !content) return;

  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  await db.fieldMessage.create({
    data: {
      campaignId: activeCampaignId,
      title,
      content,
      priority,
      expiresAt,
      createdById: session.user.id,
    },
  });

  revalidatePath("/field-messages");
}

export async function deleteFieldMessage(id: string) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (
    activeRole !== "candidate" &&
    activeRole !== "campaign_manager" &&
    activeRole !== "data_manager" &&
    activeRole !== "field_organizer"
  ) {
    return;
  }

  await db.fieldMessage.updateMany({
    where: { id, campaignId: activeCampaignId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/field-messages");
}
