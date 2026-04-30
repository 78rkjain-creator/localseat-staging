"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { addTeamMember } from "@/app/(app)/team/actions";
import { Role, ListSource, VolunteerStatus } from "@prisma/client";
import { parseTagList } from "@/lib/csv-import";
import { geocodeAndClassifyAddress } from "@/lib/ward";
import type { TeamReviewRow } from "@/lib/team-csv-import";

// ── Permission constants ──────────────────────────────────────────────────────

const PERMITTED_ROLES = new Set<Role>([
  Role.candidate,
  Role.campaign_manager,
  Role.co_chair,
  Role.field_organizer,
]);

const FO_ALLOWED_ROLES = new Set<Role>([Role.canvasser, Role.sign_installer]);

// ── Tag plan types (exported for client use) ──────────────────────────────────

export interface TagPlanResolution {
  originalLower: string;
  action: "use" | "create" | "skip";
  tagId?: string;
  createName?: string;
}

export interface TagPlan {
  resolutions: TagPlanResolution[];
}

// ── checkExistingMembers ──────────────────────────────────────────────────────

export async function checkExistingMembers(emails: string[]): Promise<{
  skippedEmails: string[];
  linkedExistingEmails: string[];
}> {
  const session = await getServerSession(authOptions);
  if (!session) return { skippedEmails: [], linkedExistingEmails: [] };

  const campaignId = session.user.activeCampaignId;
  if (!campaignId) return { skippedEmails: [], linkedExistingEmails: [] };

  const normalizedEmails = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (normalizedEmails.length === 0) return { skippedEmails: [], linkedExistingEmails: [] };

  const users = await db.user.findMany({
    where: { email: { in: normalizedEmails } },
    select: { id: true, email: true },
  });

  if (users.length === 0) return { skippedEmails: [], linkedExistingEmails: [] };

  const memberships = await db.campaignMembership.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      campaignId,
      deletedAt: null,
    },
    select: { userId: true },
  });

  const memberedUserIds = new Set(memberships.map((m) => m.userId));
  const skippedEmails: string[] = [];
  const linkedExistingEmails: string[] = [];

  for (const user of users) {
    if (memberedUserIds.has(user.id)) {
      skippedEmails.push(user.email);
    } else {
      linkedExistingEmails.push(user.email);
    }
  }

  return { skippedEmails, linkedExistingEmails };
}

// ── Helper: apply tags to a person ───────────────────────────────────────────

async function applyTagsToTeamMember(
  personId: string,
  tagIds: string[],
): Promise<void> {
  if (tagIds.length === 0) return;
  await db.personTag.createMany({
    data: tagIds.map((tagId) => ({ personId, tagId })),
    skipDuplicates: true,
  });
}

// ── commitTeamImport ──────────────────────────────────────────────────────────

export async function commitTeamImport(args: {
  rows: TeamReviewRow[];
  skipVerification: boolean;
  sendWelcomeEmail: boolean;
  tagPlan: TagPlan;
}): Promise<{
  created: number;
  linked: number;
  skipped: number;
  failed: { row: number; reason: string }[];
  errors?: string;
}> {
  const session = await getServerSession(authOptions);
  if (!session) return { created: 0, linked: 0, skipped: 0, failed: [], errors: "Not authenticated." };

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { created: 0, linked: 0, skipped: 0, failed: [], errors: "No active campaign." };
  if (!activeRole || !PERMITTED_ROLES.has(activeRole as Role)) {
    return { created: 0, linked: 0, skipped: 0, failed: [], errors: "Not authorized to import team members." };
  }

  const isFieldOrg = activeRole === Role.field_organizer;

  // ── Resolve tag plan ────────────────────────────────────────────────────────

  const tagIdByLower = new Map<string, string | null>();

  for (const res of args.tagPlan.resolutions) {
    if (res.action === "skip") {
      tagIdByLower.set(res.originalLower, null);
    } else if (res.action === "use" && res.tagId) {
      tagIdByLower.set(res.originalLower, res.tagId);
    } else if (res.action === "create" && res.createName) {
      try {
        const newTag = await db.tag.create({
          data: { campaignId: activeCampaignId, name: res.createName, color: "#94a3b8" },
          select: { id: true },
        });
        tagIdByLower.set(res.originalLower, newTag.id);
      } catch {
        tagIdByLower.set(res.originalLower, null);
      }
    }
  }

  // ── Per-row processing ──────────────────────────────────────────────────────

  let created = 0;
  let linked = 0;
  let skipped = 0;
  const failed: { row: number; reason: string }[] = [];

  for (const row of args.rows) {
    // Normalize role first so we can branch on volunteer before any status checks
    const rawRole = row.fields.role.trim().toLowerCase().replace(/[\s-]+/g, "_");

    // ── Volunteer rows: create Person + VolunteerRecord, no User/Membership ──
    if (rawRole === "volunteer") {
      if (row.status === "rejected") continue;

      try {
        const f = row.fields;
        const normalizedEmail = f.email?.trim().toLowerCase() || null;

        const existingPerson = normalizedEmail
          ? await db.person.findFirst({
              where: { campaignId: activeCampaignId, email: normalizedEmail, deletedAt: null },
              select: { id: true, householdId: true },
            })
          : null;

        let personId: string;
        let existingHouseholdId: string | null = existingPerson?.householdId ?? null;

        if (existingPerson) {
          personId = existingPerson.id;
        } else {
          const person = await db.person.create({
            data: {
              campaignId: activeCampaignId,
              firstName: f.firstName.trim(),
              lastName: f.lastName.trim() || "",
              email: normalizedEmail,
              phoneMobile: f.phoneMobile.trim() || null,
              phoneHome: f.phoneHome.trim() || null,
              listSource: ListSource.manual,
              includeInWalkLists: false,
              needsDistrictClassification: true,
            },
            select: { id: true },
          });
          personId = person.id;
        }

        await db.volunteerRecord.upsert({
          where: { campaignId_personId: { campaignId: activeCampaignId, personId } },
          create: { campaignId: activeCampaignId, personId, status: VolunteerStatus.interested },
          update: { deletedAt: null, status: VolunteerStatus.interested },
        });

        const sn   = f.streetNumber.trim() || null;
        const st   = f.streetName.trim()   || null;
        const ct   = f.city.trim()         || null;
        const pc   = f.postalCode.trim().replace(/\s/g, "").toUpperCase() || null;
        const unit = f.unitNumber.trim()   || null;
        const prov = f.province.trim()     || "ON";
        const hasAny = !!(sn || st || ct || pc);
        const hasAll = !!(sn && st && ct && pc);

        if (hasAny && !existingHouseholdId) {
          let addr: { id: string } | null = null;
          if (hasAll) {
            addr = await db.address.findFirst({
              where: {
                campaignId: activeCampaignId,
                deletedAt: null,
                streetNumber: { equals: sn!, mode: "insensitive" },
                streetName:   { equals: st!, mode: "insensitive" },
                unitNumber:   unit ? { equals: unit, mode: "insensitive" } : null,
                postalCode:   { equals: pc!, mode: "insensitive" },
              },
              select: { id: true },
            });
          }
          if (!addr) {
            addr = await db.address.create({
              data: {
                campaignId: activeCampaignId,
                streetNumber: sn ?? "",
                streetName:   st ?? "",
                unitNumber:   unit,
                city:         ct ?? "",
                province:     prov,
                postalCode:   pc ?? "",
              },
              select: { id: true },
            });
          }
          let hh = await db.household.findFirst({
            where: { campaignId: activeCampaignId, addressId: addr.id, deletedAt: null },
            select: { id: true },
          });
          if (!hh) {
            hh = await db.household.create({
              data: { campaignId: activeCampaignId, addressId: addr.id },
              select: { id: true },
            });
          }
          await db.person.update({
            where: { id: personId },
            data: { householdId: hh.id },
          });
          void geocodeAndClassifyAddress(addr.id, activeCampaignId, personId);
        }

        if (tagIdByLower.size > 0 && f.tags) {
          const tagIds = parseTagList(f.tags)
            .map((name) => tagIdByLower.get(name.toLowerCase()))
            .filter((id): id is string => typeof id === "string");
          if (tagIds.length > 0) {
            await applyTagsToTeamMember(personId, tagIds);
          }
        }

        created++;
      } catch {
        failed.push({ row: row.originalRowNum, reason: "Unexpected error creating volunteer record." });
      }
      continue;
    }

    // ── Regular team member rows ──────────────────────────────────────────────
    // Skip rows that should be passed over
    if (row.status === "rejected") continue;
    if (row.status === "skipped_already_member") {
      skipped++;
      continue;
    }

    const isLinked = row.status === "linked_existing_user";

    // Validate role against Role enum
    if (!Object.values(Role).includes(rawRole as Role)) {
      failed.push({
        row: row.originalRowNum,
        reason: `Invalid role "${row.fields.role}". Must be one of: ${Object.values(Role).join(", ")}.`,
      });
      continue;
    }

    const role = rawRole as Role;

    // Field organizer permission check
    if (isFieldOrg && !FO_ALLOWED_ROLES.has(role)) {
      failed.push({
        row: row.originalRowNum,
        reason: `Field organizers can only add canvasser or sign_installer. Got: ${rawRole}.`,
      });
      continue;
    }

    try {
      const result = await addTeamMember({
        email:          row.fields.email.trim(),
        firstName:      row.fields.firstName.trim(),
        lastName:       row.fields.lastName.trim(),
        role:           rawRole,
        phoneHome:      row.fields.phoneHome.trim() || null,
        phoneMobile:    row.fields.phoneMobile.trim() || null,
        skipVerification: args.skipVerification,
        streetNumber:   row.fields.streetNumber.trim() || null,
        streetName:     row.fields.streetName.trim() || null,
        unitNumber:     row.fields.unitNumber.trim() || null,
        city:           row.fields.city.trim() || null,
        province:       row.fields.province.trim() || null,
        postalCode:     row.fields.postalCode.trim() || null,
      });

      if (result.error) {
        failed.push({ row: row.originalRowNum, reason: result.error });
        continue;
      }

      if (isLinked) linked++;
      else created++;

      // Apply tags
      if (result.personId && tagIdByLower.size > 0 && row.fields.tags) {
        const tagIds = parseTagList(row.fields.tags)
          .map((name) => tagIdByLower.get(name.toLowerCase()))
          .filter((id): id is string => typeof id === "string");

        if (tagIds.length > 0) {
          await applyTagsToTeamMember(result.personId, tagIds);
        }
      }
    } catch {
      failed.push({ row: row.originalRowNum, reason: "Unexpected error during import." });
    }
  }

  revalidatePath("/team");
  revalidatePath("/import/team");
  revalidatePath("/people/volunteers");

  return { created, linked, skipped, failed };
}
