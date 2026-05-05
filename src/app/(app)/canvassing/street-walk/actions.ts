"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { checkSupportWriteAccess } from "@/lib/support-access";
import { canAddConstituent } from "@/lib/plan-limits";
import { sanitizeText, sanitizeEnum } from "@/lib/sanitize";
import { WardStatus, ListSource } from "@prisma/client";
import { SUPPORT_LEVEL_VALUES } from "@/types";
import type { SupportLevel } from "@/types";

// Normalize street name for fuzzy matching — strip common suffix words so
// "Oak Street" matches "Oak St" and "Oak".
function normalizeStreetName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(
      /\b(street|avenue|road|drive|boulevard|crescent|court|place|lane|way|st|ave|rd|dr|blvd|cres|ct|pl|ln|wy)\b\.?/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

// ── Check address ─────────────────────────────────────────────────────────────

export interface CheckAddressResult {
  error?: string;
  exists: boolean;
  addressId?: string;
  householdId?: string;
  residents?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    currentSupportLevel?: string;
    lastCanvassed?: string;
  }>;
}

export async function checkAddress(
  streetNumber: string,
  streetName: string,
  city: string
): Promise<CheckAddressResult> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated.", exists: false };

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return { error: "No active campaign.", exists: false };

  if (!streetNumber.trim() || !streetName.trim() || !city.trim()) {
    return { error: "Street number, name, and city are required.", exists: false };
  }

  const candidates = await db.address.findMany({
    where: {
      campaignId: activeCampaignId,
      streetNumber: { equals: streetNumber.trim(), mode: "insensitive" },
      city: { equals: city.trim(), mode: "insensitive" },
      deletedAt: null,
    },
    select: {
      id: true,
      streetName: true,
      households: {
        where: { deletedAt: null },
        select: {
          id: true,
          people: {
            where: { deletedAt: null },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              canvassResponses: {
                orderBy: { respondedAt: "desc" },
                take: 1,
                select: { supportLevel: true, respondedAt: true },
              },
            },
          },
        },
      },
    },
  });

  const normalizedInput = normalizeStreetName(streetName);
  const match = candidates.find(
    (a) => normalizeStreetName(a.streetName) === normalizedInput
  );

  if (!match) return { exists: false };

  const household = match.households[0];
  const residents = (household?.people ?? []).map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    currentSupportLevel: p.canvassResponses[0]?.supportLevel ?? undefined,
    lastCanvassed: p.canvassResponses[0]?.respondedAt?.toISOString() ?? undefined,
  }));

  return {
    exists: true,
    addressId: match.id,
    householdId: household?.id,
    residents,
  };
}

// ── Save street walk entry ────────────────────────────────────────────────────

export interface StreetWalkPerson {
  id?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  supportLevel?: string;
  signRequest?: boolean;
  volunteerInterest?: boolean;
  donorInterest?: boolean;
  notes?: string;
}

export interface SaveStreetWalkInput {
  streetNumber: string;
  unit?: string;
  streetName: string;
  city: string;
  province: string;
  postalCode?: string;
  existingAddressId?: string;
  existingHouseholdId?: string;
  people: StreetWalkPerson[];
}

export async function saveStreetWalkEntry(
  data: SaveStreetWalkInput
): Promise<{ error?: string; saved?: number }> {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." };

  const { activeCampaignId } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." };

  const supportCheck = await checkSupportWriteAccess();
  if (!supportCheck.allowed) return { error: supportCheck.error! };

  if (!data.streetNumber.trim() || !data.streetName.trim() || !data.city.trim()) {
    return { error: "Street number, name, and city are required." };
  }

  // Find or create a "Street Walk (System)" canvass list — used as the container
  // for all street-walk CanvassResponse records. This avoids adding a nullable
  // assignmentId to the schema while keeping the data model consistent.
  // TODO: When offline queuing is added, this list should be pre-fetched and
  //       cached alongside the canvasser's assigned lists.
  let systemList = await db.canvassList.findFirst({
    where: { campaignId: activeCampaignId, name: "Street Walk (System)", deletedAt: null },
    select: { id: true },
  });
  if (!systemList) {
    systemList = await db.canvassList.create({
      data: {
        campaignId: activeCampaignId,
        name: "Street Walk (System)",
        description: "Auto-created for street walk canvassing. Do not archive.",
        status: "active",
      },
      select: { id: true },
    });
  }

  // One persistent assignment per canvasser on the system list
  let assignment = await db.canvassAssignment.findFirst({
    where: { canvassListId: systemList.id, canvasserId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!assignment) {
    assignment = await db.canvassAssignment.create({
      data: { canvassListId: systemList.id, canvasserId: session.user.id },
      select: { id: true },
    });
  }

  // Find or create address — server-side dedup regardless of what the client reports
  let addressId = data.existingAddressId;
  if (!addressId) {
    const normalizedInput = normalizeStreetName(data.streetName);
    const candidates = await db.address.findMany({
      where: {
        campaignId: activeCampaignId,
        streetNumber: { equals: data.streetNumber.trim(), mode: "insensitive" },
        city: { equals: data.city.trim(), mode: "insensitive" },
        deletedAt: null,
      },
      select: { id: true, streetName: true },
    });
    const existing = candidates.find(
      (a) => normalizeStreetName(a.streetName) === normalizedInput
    );
    if (existing) {
      addressId = existing.id;
    } else {
      const created = await db.address.create({
        data: {
          campaignId: activeCampaignId,
          streetNumber: data.streetNumber.trim(),
          streetName: data.streetName.trim(),
          unitNumber: data.unit?.trim() || null,
          city: data.city.trim(),
          province: data.province.trim() || "ON",
          postalCode: data.postalCode?.trim() ?? "",
        },
        select: { id: true },
      });
      addressId = created.id;
    }
  }

  // Find or create household for this address
  let householdId = data.existingHouseholdId;
  if (!householdId) {
    const existing = await db.household.findFirst({
      where: { addressId, campaignId: activeCampaignId, deletedAt: null },
      select: { id: true },
    });
    householdId = existing?.id;
    if (!householdId) {
      const created = await db.household.create({
        data: { campaignId: activeCampaignId, addressId },
        select: { id: true },
      });
      householdId = created.id;
    }
  }

  // Plan limit check before creating new people
  const newCount = data.people.filter((p) => !p.id).length;
  if (newCount > 0) {
    const currentCount = await db.person.count({
      where: { campaignId: activeCampaignId, deletedAt: null },
    });
    const allowed = await canAddConstituent(activeCampaignId, currentCount);
    if (!allowed) return { error: "Constituent limit reached. Contact your campaign manager." };
  }

  // Field-entry tag — optional, skip silently if not found
  const fieldEntryTag = await db.tag.findFirst({
    where: { campaignId: activeCampaignId, name: "field-entry", deletedAt: null },
    select: { id: true },
  });

  let saved = 0;

  for (const personData of data.people) {
    let personId = personData.id;

    if (!personId) {
      const firstName = personData.firstName?.trim();
      const lastName = personData.lastName?.trim();
      if (!firstName || !lastName) continue;

      // Dedup: same name at same address = treat as existing
      const dup = await db.person.findFirst({
        where: {
          campaignId: activeCampaignId,
          householdId,
          firstName: { equals: firstName, mode: "insensitive" },
          lastName: { equals: lastName, mode: "insensitive" },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (dup) {
        personId = dup.id;
      } else {
        const supportLevel = personData.supportLevel
          ? (sanitizeEnum(personData.supportLevel, SUPPORT_LEVEL_VALUES) as SupportLevel | null)
          : null;

        const created = await db.person.create({
          data: {
            campaignId: activeCampaignId,
            householdId,
            firstName,
            lastName,
            phoneMobile: personData.phone?.trim() || null,
            email: personData.email?.trim() || null,
            listSource: ListSource.canvass,
            wardStatus: WardStatus.not_checked,
            includeInWalkLists: true,
            ...(supportLevel ? { supportLevel } : {}),
          },
          select: { id: true },
        });
        personId = created.id;

        if (fieldEntryTag) {
          try {
            await db.personTag.create({ data: { personId, tagId: fieldEntryTag.id } });
          } catch { /* tag may already exist */ }
        }
      }
    } else {
      // Existing person — update contact info if newly provided
      const patch: Record<string, string> = {};
      if (personData.phone?.trim()) patch.phoneMobile = personData.phone.trim();
      if (personData.email?.trim()) patch.email = personData.email.trim();
      if (Object.keys(patch).length > 0) {
        await db.person.update({ where: { id: personId }, data: patch });
      }
    }

    if (!personId) continue;

    // Record canvass response when a support level was captured
    if (personData.supportLevel) {
      const supportLevel = sanitizeEnum(
        personData.supportLevel,
        SUPPORT_LEVEL_VALUES
      ) as SupportLevel | null;

      if (supportLevel) {
        const noteText = sanitizeText(personData.notes ?? "", 2000);

        await db.canvassResponse.create({
          data: {
            assignmentId: assignment.id,
            personId,
            outcome: "contacted",
            supportLevel,
            signRequest: personData.signRequest ?? false,
            volunteerInterest: personData.volunteerInterest ?? false,
            donorInterest: personData.donorInterest ?? false,
            notes: noteText,
            needsFollowUp: false,
          },
        });

        // Keep Person.supportLevel in sync with the latest response
        await db.person.update({
          where: { id: personId },
          data: { supportLevel },
        });

        // Auto-log outreach entry — non-critical
        try {
          await db.outreachLog.create({
            data: {
              campaignId: activeCampaignId,
              personId,
              userId: session.user.id,
              channel: "door_knock",
              date: new Date(),
              outcome: `Support: ${supportLevel}`,
              notes: personData.notes?.trim() || null,
            },
          });
        } catch { /* non-critical */ }

        saved++;
      }
    }
  }

  await createAuditLog({
    campaignId: activeCampaignId,
    userId: session.user.id,
    action: "STREET_WALK_SAVED",
    entityType: "address",
    entityId: addressId,
    details: {
      streetNumber: data.streetNumber,
      streetName: data.streetName,
      city: data.city,
      saved,
    },
  });

  return { saved };
}
