"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface SaveMunicipalityState {
  error?: string;
}

const ALLOWED_NEXT_URLS = ["/dashboard", "/onboarding/choose-plan"];

export async function saveMunicipality(
  _prev: SaveMunicipalityState,
  formData: FormData
): Promise<SaveMunicipalityState> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const campaignId = (formData.get("campaignId") as string | null)?.trim();
  if (!campaignId) return { error: "Missing campaign." };

  const isPending = (formData.get("isPending") as string | null) === "true";

  const municipalityName = (formData.get("municipalityName") as string | null)?.trim() || null;
  const municipalityId   = (formData.get("municipalityId")   as string | null)?.trim() || null;
  const boundaryRaw      = (formData.get("municipalityBoundary") as string | null)?.trim() || null;

  let municipalityBoundary: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
  if (boundaryRaw) {
    try {
      municipalityBoundary = JSON.parse(boundaryRaw) as Prisma.InputJsonValue;
    } catch {
      return { error: "Invalid boundary data." };
    }
  }

  const rawNext = (formData.get("nextUrl") as string | null)?.trim() || "";
  const nextUrl = ALLOWED_NEXT_URLS.find((u) => rawNext.startsWith(u)) ?? "/dashboard";

  if (isPending) {
    // Update the pending campaign record (pre-payment)
    const pending = await db.pendingCampaign.findUnique({
      where: { id: campaignId },
      select: { userId: true },
    });
    if (!pending || pending.userId !== session.user.id) {
      return { error: "Pending campaign not found." };
    }
    await db.pendingCampaign.update({
      where: { id: campaignId },
      data: {
        municipalityName: municipalityName ?? null,
        municipalityId: municipalityId ?? null,
        municipalityBoundary: municipalityBoundary === Prisma.JsonNull ? Prisma.JsonNull : municipalityBoundary,
      },
    });
    redirect(nextUrl);
  }

  // Existing campaign flow
  const membership = await db.campaignMembership.findFirst({
    where: { userId: session.user.id, campaignId, deletedAt: null },
    select: { role: true },
  });
  if (!membership || (membership.role !== "candidate" && membership.role !== "campaign_manager")) {
    return { error: "You don't have permission to update this campaign." };
  }

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      municipalityName: municipalityName ?? null,
      municipalityId: municipalityId ?? null,
      municipalityBoundary,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/campaign-settings/general");
  redirect(nextUrl);
}
