"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasMinimumRole } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { Role, OutOfDistrictApprovalStatus, ListSource } from "@prisma/client";

const FULL_ACCESS: Role[] = [Role.candidate, Role.campaign_manager, Role.data_manager];

async function getSessionAndPerson(personId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.activeCampaignId) return { error: "Not authenticated." } as const;

  const { activeCampaignId, activeRole, id: userId } = session.user;
  if (!activeRole) return { error: "No active role." } as const;

  const person = await db.person.findFirst({
    where: { id: personId, campaignId: activeCampaignId, deletedAt: null },
    select: {
      id: true,
      listSource: true,
      isOutOfDistrict: true,
      outOfDistrictApprovalStatus: true,
    },
  });
  if (!person) return { error: "Person not found." } as const;

  return { session, activeCampaignId, activeRole: activeRole as Role, userId, person } as const;
}

// ── requestOutOfDistrictMark ──────────────────────────────────────────────────
// All roles FO and above: immediate approval, no pending queue.

export async function requestOutOfDistrictMark(
  personId: string
): Promise<{ error?: string }> {
  const ctx = await getSessionAndPerson(personId);
  if ("error" in ctx) return { error: ctx.error };

  const { activeCampaignId, activeRole, userId, person } = ctx;

  if (!hasMinimumRole(activeRole, Role.field_organizer)) {
    return { error: "Permission denied." };
  }
  if (person.listSource === ListSource.team) {
    return { error: "Team members use a separate classification flow." };
  }

  await db.person.update({
    where: { id: personId },
    data: {
      isOutOfDistrict: true,
      outOfDistrictApprovalStatus: OutOfDistrictApprovalStatus.approved,
      needsDistrictClassification: false,
    },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId,
    action: "OOD_MARK_APPROVED",
    entityType: "person",
    entityId: personId,
    details: { from: person.outOfDistrictApprovalStatus, to: "approved", actorRole: activeRole },
  });

  revalidatePath(`/people/${personId}`);
  revalidatePath("/people/out-of-district");
  return {};
}

// ── removeOutOfDistrict ───────────────────────────────────────────────────────
// Candidate, campaign_manager, and data_manager only.

export async function removeOutOfDistrict(
  personId: string
): Promise<{ error?: string }> {
  const ctx = await getSessionAndPerson(personId);
  if ("error" in ctx) return { error: ctx.error };

  const { activeCampaignId, activeRole, userId, person } = ctx;

  if (!FULL_ACCESS.includes(activeRole)) {
    return { error: "Only the candidate or campaign manager may remove the out-of-district mark." };
  }

  const prevStatus = person.outOfDistrictApprovalStatus;

  await db.person.update({
    where: { id: personId },
    data: {
      isOutOfDistrict: false,
      outOfDistrictApprovalStatus: null,
    },
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId,
    action: "OOD_REMOVED",
    entityType: "person",
    entityId: personId,
    details: { from: prevStatus, to: null, actorRole: activeRole },
  });

  revalidatePath(`/people/${personId}`);
  revalidatePath("/people/out-of-district");
  return {};
}
