"use server";

// State machine for constituent out-of-district approval:
//
//  [not_marked] isOutOfDistrict=false, status=null
//       │
//       ├─[Cand/CM] requestOutOfDistrictMark ──► [approved] isOutOfDistrict=true, status=approved
//       │                                                │
//       │                                         [Cand/CM] removeOutOfDistrict
//       │                                                │
//       │                                        [not_marked] ◄─────────────────┐
//       │                                                                        │
//       └─[FO] requestOutOfDistrictMark ──► [pending] isOutOfDistrict=false, status=pending
//                                                 │
//                                                 ├─[Cand/CM] approveOutOfDistrict ──► [approved]
//                                                 │
//                                                 └─[Cand/CM] rejectOutOfDistrict ──► [rejected]
//                                                                                          │
//                                                                                   isOutOfDistrict=false, status=rejected
//                                                                                   (FO may re-submit via requestOutOfDistrictMark)

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasMinimumRole } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { Role, OutOfDistrictApprovalStatus, ListSource, type Prisma } from "@prisma/client";

// New OOD fields exist in the DB after migration but are not yet in the generated
// Prisma client types. This helper casts the data object so typecheck passes.
// Remove after running `prisma generate`.
function oodData(data: Record<string, unknown>): Prisma.PersonUpdateInput {
  return data as unknown as Prisma.PersonUpdateInput;
}

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
// Candidate/CM: immediate approval. Field organizer: creates pending request.
// Team members are excluded — their classification goes through a separate flow.

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

  const isFullAccess = FULL_ACCESS.includes(activeRole);

  if (isFullAccess) {
    await db.person.update({
      where: { id: personId },
      data: oodData({
        isOutOfDistrict: true,
        outOfDistrictApprovalStatus: OutOfDistrictApprovalStatus.approved,
        outOfDistrictRequestedById: null,
        outOfDistrictRequestedAt: null,
        outOfDistrictRejectionReason: null,
        needsDistrictClassification: false,
      }),
    });
    await createAuditLog({
      campaignId: activeCampaignId,
      userId,
      action: "OOD_MARK_APPROVED",
      entityType: "person",
      entityId: personId,
      details: { from: person.outOfDistrictApprovalStatus, to: "approved", actorRole: activeRole },
    });
  } else {
    // Field organizer: pend for approval; does not set isOutOfDistrict yet
    await db.person.update({
      where: { id: personId },
      data: oodData({
        isOutOfDistrict: false,
        outOfDistrictApprovalStatus: OutOfDistrictApprovalStatus.pending,
        outOfDistrictRequestedById: userId,
        outOfDistrictRequestedAt: new Date(),
        outOfDistrictRejectionReason: null,
        needsDistrictClassification: false,
      }),
    });
    await createAuditLog({
      campaignId: activeCampaignId,
      userId,
      action: "OOD_MARK_REQUESTED",
      entityType: "person",
      entityId: personId,
      details: { from: person.outOfDistrictApprovalStatus, to: "pending", actorRole: activeRole },
    });
  }

  revalidatePath(`/people/${personId}`);
  revalidatePath("/people/out-of-district");
  revalidatePath("/people/out-of-district/pending");
  return {};
}

// ── approveOutOfDistrict ──────────────────────────────────────────────────────
// Candidate and campaign_manager only.

export async function approveOutOfDistrict(
  personId: string
): Promise<{ error?: string }> {
  const ctx = await getSessionAndPerson(personId);
  if ("error" in ctx) return { error: ctx.error };

  const { activeCampaignId, activeRole, userId, person } = ctx;

  if (!FULL_ACCESS.includes(activeRole)) {
    return { error: "Only the candidate or campaign manager may approve." };
  }
  if (person.outOfDistrictApprovalStatus !== OutOfDistrictApprovalStatus.pending) {
    return { error: "This request is not pending approval." };
  }

  await db.person.update({
    where: { id: personId },
    data: oodData({
      isOutOfDistrict: true,
      outOfDistrictApprovalStatus: OutOfDistrictApprovalStatus.approved,
      outOfDistrictRejectionReason: null,
    }),
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId,
    action: "OOD_APPROVED",
    entityType: "person",
    entityId: personId,
    details: { from: "pending", to: "approved", actorRole: activeRole },
  });

  revalidatePath(`/people/${personId}`);
  revalidatePath("/people/out-of-district");
  revalidatePath("/people/out-of-district/pending");
  return {};
}

// ── rejectOutOfDistrict ───────────────────────────────────────────────────────
// Candidate and campaign_manager only. Optional rejection reason saved to record.

export async function rejectOutOfDistrict(
  personId: string,
  reason?: string
): Promise<{ error?: string }> {
  const ctx = await getSessionAndPerson(personId);
  if ("error" in ctx) return { error: ctx.error };

  const { activeCampaignId, activeRole, userId, person } = ctx;

  if (!FULL_ACCESS.includes(activeRole)) {
    return { error: "Only the candidate or campaign manager may reject." };
  }
  if (person.outOfDistrictApprovalStatus !== OutOfDistrictApprovalStatus.pending) {
    return { error: "This request is not pending approval." };
  }

  await db.person.update({
    where: { id: personId },
    data: oodData({
      isOutOfDistrict: false,
      outOfDistrictApprovalStatus: OutOfDistrictApprovalStatus.rejected,
      outOfDistrictRejectionReason: reason?.trim() || null,
    }),
  });

  await createAuditLog({
    campaignId: activeCampaignId,
    userId,
    action: "OOD_REJECTED",
    entityType: "person",
    entityId: personId,
    details: { from: "pending", to: "rejected", reason: reason?.trim() || null, actorRole: activeRole },
  });

  revalidatePath(`/people/${personId}`);
  revalidatePath("/people/out-of-district");
  revalidatePath("/people/out-of-district/pending");
  return {};
}

// ── removeOutOfDistrict ───────────────────────────────────────────────────────
// Candidate and campaign_manager only. Resets the person back to unclassified.

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
    data: oodData({
      isOutOfDistrict: false,
      outOfDistrictApprovalStatus: null,
      outOfDistrictRequestedById: null,
      outOfDistrictRequestedAt: null,
      outOfDistrictRejectionReason: null,
    }),
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
  revalidatePath("/people/out-of-district/pending");
  return {};
}
