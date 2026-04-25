"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageVoterList } from "@/lib/permissions";
import { sanitizePhone, sanitizeEmail, sanitizeBirthYear } from "@/lib/sanitize";
import { createAuditLog } from "@/lib/audit";
import { canAddConstituent } from "@/lib/plan-limits";
import { geocodeNewAddresses } from "@/lib/geocoding";
import { isPointInWard, campaignHasWard } from "@/lib/ward";
import { normalizeFullAddress } from "@/lib/address-normalize";
import { WardStatus } from "@prisma/client";
import type { Polygon, MultiPolygon } from "geojson";
import type { Role } from "@/types";

// ── Auth guard ────────────────────────────────────────────────────────────

async function requireVoterListManager() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (!activeRole || !canManageVoterList(activeRole as Role)) {
    return { error: "You don't have permission to manage the voter list." } as const;
  }

  return { session, campaignId: activeCampaignId } as const;
}

// ── Import types ──────────────────────────────────────────────────────────

export interface VoterCsvRow {
  firstName: string;
  lastName: string;
  streetNumber: string;
  streetName: string;
  unitNumber: string;   // empty string when absent
  city: string;
  province: string;
  postalCode: string;
  phoneHome: string;    // empty string when absent
  phoneMobile: string;  // empty string when absent
  email: string;        // empty string when absent
  birthYear: string;    // empty string when absent
  pollNumber: string;   // empty string when absent
  customFieldValues?: Record<string, string>;
}

export interface FlaggedRow {
  firstName: string;
  lastName: string;
  streetNumber: string;
  streetName: string;
  unitNumber: string | null;
  city: string;
  province: string;
  postalCode: string;
  wardStatus: "outside";
}

export interface VoterImportResult {
  error?: string;
  matched?: number;
  created?: number;
  skipped?: number;
  reviewCount?: number;
  flaggedRows?: FlaggedRow[];
}

// ── importVoterRows ───────────────────────────────────────────────────────

// ── checkDuplicatesForImport ──────────────────────────────────────────────
// Fetches all existing persons for the campaign once, builds a lookup map,
// then checks each incoming row by name+address and phone number in memory.
// Returns the indices of rows that match existing records.

export async function checkDuplicatesForImport(
  rows: VoterCsvRow[]
): Promise<{ rowIndex: number; matchedName: string }[]> {
  const auth = await requireVoterListManager();
  if ("error" in auth) return [];
  const { campaignId } = auth;

  const existing = await db.person.findMany({
    where: { campaignId, deletedAt: null },
    select: {
      firstName: true,
      lastName: true,
      phoneHome: true,
      phoneMobile: true,
      household: {
        select: {
          address: {
            select: { streetNumber: true, streetName: true, postalCode: true },
          },
        },
      },
    },
  });

  // Build two lookup maps: name+address → display name, phone → display name
  const byAddress = new Map<string, string>();
  const byPhone   = new Map<string, string>();

  for (const p of existing) {
    const addr = p.household?.address;
    const displayName = `${p.firstName} ${p.lastName}`;

    if (addr) {
      const key = [
        p.firstName.toLowerCase(),
        p.lastName.toLowerCase(),
        addr.streetNumber.toLowerCase(),
        addr.streetName.toLowerCase(),
        addr.postalCode.toLowerCase().replace(/\s/g, ""),
      ].join("|");
      byAddress.set(key, displayName);
    }

    const ph = sanitizePhone(p.phoneHome ?? "");
    const pm = sanitizePhone(p.phoneMobile ?? "");
    if (ph) byPhone.set(ph, displayName);
    if (pm) byPhone.set(pm, displayName);
  }

  const results: { rowIndex: number; matchedName: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstName   = row.firstName.trim().toLowerCase();
    const lastName    = row.lastName.trim().toLowerCase();
    const streetNumber = row.streetNumber.trim().toLowerCase();
    const streetName  = row.streetName.trim().toLowerCase();
    const postalCode  = row.postalCode.trim().replace(/\s/g, "").toLowerCase();

    const addrKey = [firstName, lastName, streetNumber, streetName, postalCode].join("|");
    let matchedName = byAddress.get(addrKey);

    if (!matchedName) {
      const ph = sanitizePhone(row.phoneHome);
      const pm = sanitizePhone(row.phoneMobile);
      if (ph) matchedName = byPhone.get(ph);
      if (!matchedName && pm) matchedName = byPhone.get(pm);
    }

    if (matchedName) {
      results.push({ rowIndex: i, matchedName });
    }
  }

  return results;
}

// ── importVoterRows ───────────────────────────────────────────────────────

export async function importVoterRows(
  rows: VoterCsvRow[],
  listImportType: "list" | "official_voters_list" | "telephone_list",
  listName: string
): Promise<VoterImportResult> {
  const importSource =
    listImportType === "official_voters_list"
      ? "Official Voters List"
      : listName.trim() || "voter-list-import";
  const auth = await requireVoterListManager();
  if ("error" in auth) return auth;
  const { campaignId } = auth;

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows to import." };
  }
  if (rows.length > 2000) {
    return { error: "Maximum 2,000 rows per import." };
  }

  // Plan limit check: count current constituents + batch size
  const currentCount = await db.person.count({ where: { campaignId, deletedAt: null } });
  const allowed = await canAddConstituent(campaignId, currentCount + rows.length - 1);
  if (!allowed) {
    return { error: "This campaign has reached its constituent limit for the current plan. Upgrade to import more records." };
  }

  // Fetch ward boundary and custom fields once before the transaction
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { wardBoundary: true, customFields: true },
  });

  const wardBoundary: Polygon | MultiPolygon | null =
    campaign && campaignHasWard(campaign)
      ? (campaign.wardBoundary as unknown as Polygon | MultiPolygon)
      : null;

  // Build set of valid custom field ids to validate incoming values
  type CampaignCustomField = { id: string; label: string };
  const validCustomFieldIds = new Set<string>(
    ((campaign?.customFields as CampaignCustomField[] | null) ?? []).map((f) => f.id)
  );

  let matched = 0;
  let created = 0;
  let skipped = 0;
  let reviewCount = 0;
  const flaggedRows: FlaggedRow[] = [];
  const newAddressIds: string[] = [];
  let listImportId!: string;

  await db.$transaction(
    async (tx) => {
      // Create the ListImport record first so we can link memberships to it.
      const listImport = await tx.listImport.create({
        data: {
          campaignId,
          name: listImportType === "official_voters_list" ? "Official Voters List" : listName.trim(),
          type: listImportType,
          importedById: auth.session.user.id,
          totalRows: rows.length,
        },
        select: { id: true },
      });
      listImportId = listImport.id;

      for (const row of rows) {
        const firstName   = row.firstName.trim();
        const lastName    = row.lastName.trim();
        const streetNumber = row.streetNumber.trim();
        const streetName  = row.streetName.trim();
        const city        = row.city.trim();
        const province    = row.province.trim();
        const postalCode  = row.postalCode.trim().replace(/\s/g, "").toUpperCase();
        const unitNumber  = row.unitNumber?.trim() || null;
        const phoneHome   = sanitizePhone(row.phoneHome);
        const phoneMobile = sanitizePhone(row.phoneMobile);
        const email       = sanitizeEmail(row.email);
        const birthYear   = sanitizeBirthYear(row.birthYear);
        const pollNumber  = row.pollNumber?.trim() || null;

        if (!firstName || !lastName || !streetNumber || !streetName || !city || !province || !postalCode) {
          skipped++;
          continue;
        }

        // ── Official Voters List matching ─────────────────────────────────────
        if (listImportType === "official_voters_list") {
          // 1. Normalize name: join firstName+lastName, take first and last token
          //    so "JOHN MICHAEL SMITH" → normFirst="john", normLast="smith"
          const nameTokens = `${firstName} ${lastName}`.trim().split(/\s+/).filter(Boolean);
          const normFirst = (nameTokens[0] ?? firstName).toLowerCase();
          const normLast  = (nameTokens.length > 1 ? nameTokens[nameTokens.length - 1] : lastName).toLowerCase();

          // 2. Normalize incoming address (strips units, expands abbreviations)
          const incomingAddrKey = normalizeFullAddress(`${streetNumber} ${streetName}`, city);
          const incomingUnit    = (unitNumber ?? "").toLowerCase().trim();

          // 3a. Query candidates by name
          const nameMatchRows = await tx.person.findMany({
            where: {
              campaignId,
              deletedAt: null,
              firstName: { equals: normFirst, mode: "insensitive" },
              lastName:  { equals: normLast,  mode: "insensitive" },
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              household: { select: { address: { select: { streetNumber: true, streetName: true, unitNumber: true, city: true } } } },
            },
          });

          // 3b. Query candidates by street number + city as a pre-filter for address-only matches
          const addrCandidateRows = await tx.person.findMany({
            where: {
              campaignId,
              deletedAt: null,
              household: {
                address: {
                  streetNumber: { equals: streetNumber, mode: "insensitive" },
                  city:         { equals: city,         mode: "insensitive" },
                },
              },
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              household: { select: { address: { select: { streetNumber: true, streetName: true, unitNumber: true, city: true } } } },
            },
          });

          // 4. Classify — merge both result sets, deduplicate by id
          const seen = new Set<string>();
          const allCandidates = [...nameMatchRows, ...addrCandidateRows].filter((p) => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });

          type MatchKind = "full" | "unit_mismatch" | "name_only" | "addr_only";
          let bestKind: MatchKind | null = null;
          let bestCandidateId: string | null = null;

          for (const candidate of allCandidates) {
            const addr = candidate.household?.address;
            const candNormAddr = addr
              ? normalizeFullAddress(`${addr.streetNumber} ${addr.streetName}`, addr.city)
              : null;
            const candUnit      = (addr?.unitNumber ?? "").toLowerCase().trim();
            const candFirstNorm = candidate.firstName.toLowerCase();
            const candLastNorm  = candidate.lastName.toLowerCase();

            const nameMatch = candFirstNorm === normFirst && candLastNorm === normLast;
            const addrMatch = candNormAddr !== null && candNormAddr === incomingAddrKey;
            const unitMatch = candUnit === incomingUnit;

            let kind: MatchKind | null = null;
            if (nameMatch && addrMatch && unitMatch)  kind = "full";
            else if (nameMatch && addrMatch)          kind = "unit_mismatch";
            else if (nameMatch)                       kind = "name_only";
            else if (addrMatch)                       kind = "addr_only";

            // Prefer more specific matches (full > unit_mismatch > name_only / addr_only)
            const priority: Record<MatchKind, number> = { full: 0, unit_mismatch: 1, name_only: 2, addr_only: 2 };
            if (kind && (bestKind === null || priority[kind] < priority[bestKind])) {
              bestKind = kind;
              bestCandidateId = candidate.id;
            }

            if (bestKind === "full") break; // can't do better
          }

          if (bestKind === "full" && bestCandidateId) {
            // Full match — confirm voter, no review needed
            matched++;
            await tx.person.update({ where: { id: bestCandidateId }, data: { isConfirmedVoter: true, ...(pollNumber ? { pollNumber } : {}) } });
            await tx.personListMembership.create({
              data: { personId: bestCandidateId, listImportId, campaignId, status: "matched" },
            });

          } else if (bestKind !== null && bestCandidateId) {
            // Partial match — flag for review with reason
            reviewCount++;
            const reviewReason =
              bestKind === "unit_mismatch" ? "Same address, different unit" :
              bestKind === "name_only"     ? "Name matches, address differs" :
                                             "Address matches, name differs";
            await tx.personListMembership.create({
              data: { personId: bestCandidateId, listImportId, campaignId, status: "pending_review", reviewReason },
            });

          } else {
            // No match anywhere — create a new confirmed-voter record
            const existingOvlAddress = await tx.address.findFirst({
              where: {
                campaignId,
                deletedAt: null,
                streetNumber: { equals: streetNumber, mode: "insensitive" },
                streetName:   { equals: streetName,   mode: "insensitive" },
                unitNumber:   unitNumber ? { equals: unitNumber, mode: "insensitive" } : null,
                postalCode:   { equals: postalCode,   mode: "insensitive" },
              },
              select: { id: true },
            });

            let ovlAddressId: string;
            if (existingOvlAddress) {
              ovlAddressId = existingOvlAddress.id;
            } else {
              const newAddr = await tx.address.create({
                data: { campaignId, streetNumber, streetName, unitNumber, city, province, postalCode },
                select: { id: true },
              });
              ovlAddressId = newAddr.id;
              newAddressIds.push(ovlAddressId);
            }

            let ovlHousehold = await tx.household.findFirst({
              where: { campaignId, addressId: ovlAddressId, deletedAt: null },
              select: { id: true },
            });
            if (!ovlHousehold) {
              ovlHousehold = await tx.household.create({
                data: { campaignId, addressId: ovlAddressId },
                select: { id: true },
              });
            }

            const sanitisedCfv: Record<string, string> | null = (() => {
              const incoming = row.customFieldValues;
              if (!incoming || validCustomFieldIds.size === 0) return null;
              const safe: Record<string, string> = {};
              for (const [k, v] of Object.entries(incoming)) {
                if (validCustomFieldIds.has(k) && v.trim()) safe[k] = v.trim();
              }
              return Object.keys(safe).length > 0 ? safe : null;
            })();

            const ovlPerson = await tx.person.create({
              data: {
                campaignId,
                householdId:      ovlHousehold.id,
                firstName,
                lastName,
                phoneHome:        phoneHome   ?? undefined,
                phoneMobile:      phoneMobile ?? undefined,
                email:            email       ?? undefined,
                birthYear:        birthYear   ?? undefined,
                importSource:     "Official Voters List",
                isConfirmedVoter: true,
                pollNumber:       pollNumber ?? undefined,
                ...(sanitisedCfv ? { customFieldValues: sanitisedCfv } : {}),
              },
              select: { id: true },
            });

            await tx.personListMembership.create({
              data: { personId: ovlPerson.id, listImportId, campaignId, status: "created" },
            });
            created++;
          }

          continue; // skip regular-list logic below
        }

        // 1. Try to match an existing person by name + address
        const existingPerson = await tx.person.findFirst({
          where: {
            campaignId,
            deletedAt: null,
            firstName: { equals: firstName, mode: "insensitive" },
            lastName:  { equals: lastName,  mode: "insensitive" },
            household: {
              address: {
                streetNumber: { equals: streetNumber, mode: "insensitive" },
                streetName:   { equals: streetName,   mode: "insensitive" },
                unitNumber:   unitNumber
                  ? { equals: unitNumber, mode: "insensitive" }
                  : null,
                postalCode:   { equals: postalCode,   mode: "insensitive" },
              },
            },
          },
          select: { id: true },
        });

        if (existingPerson) {
          matched++;
          await tx.personListMembership.create({
            data: {
              personId:     existingPerson.id,
              listImportId: listImportId,
              campaignId,
              status:       "matched",
            },
          });
          continue;
        }

        // 2. Find or create address
        // Select lat/lng so we can check ward membership for existing geocoded addresses.
        let addressId: string;
        let addressLat: number | null = null;
        let addressLng: number | null = null;

        const existingAddress = await tx.address.findFirst({
          where: {
            campaignId,
            deletedAt: null,
            streetNumber: { equals: streetNumber, mode: "insensitive" },
            streetName:   { equals: streetName,   mode: "insensitive" },
            unitNumber:   unitNumber
              ? { equals: unitNumber, mode: "insensitive" }
              : null,
            postalCode:   { equals: postalCode,   mode: "insensitive" },
          },
          select: { id: true, lat: true, lng: true },
        });

        if (existingAddress) {
          addressId  = existingAddress.id;
          addressLat = existingAddress.lat;
          addressLng = existingAddress.lng;
        } else {
          const newAddress = await tx.address.create({
            data: { campaignId, streetNumber, streetName, unitNumber, city, province, postalCode },
            select: { id: true },
          });
          addressId = newAddress.id;
          newAddressIds.push(addressId);
          // lat/lng are null — geocoding fires after the transaction
        }

        // 2a. Ward boundary check
        // Only possible when the campaign has a boundary AND the address is already geocoded.
        // Newly created addresses have no lat/lng yet → not_checked.
        let wardStatus: WardStatus = WardStatus.not_checked;
        if (wardBoundary && addressLat !== null && addressLng !== null) {
          wardStatus = isPointInWard(addressLat, addressLng, wardBoundary)
            ? WardStatus.inside
            : WardStatus.outside;
        }

        if (wardStatus === WardStatus.outside) {
          flaggedRows.push({
            firstName,
            lastName,
            streetNumber,
            streetName,
            unitNumber,
            city,
            province,
            postalCode,
            wardStatus: "outside",
          });
          // Do not create the person record — leave address/household in place
          continue;
        }

        // 3. Find or create household
        let household = await tx.household.findFirst({
          where: { campaignId, addressId, deletedAt: null },
          select: { id: true },
        });

        if (!household) {
          household = await tx.household.create({
            data: { campaignId, addressId },
            select: { id: true },
          });
        }

        // 4. Create person
        // Filter incoming custom field values to only known field ids
        const sanitisedCustomFieldValues: Record<string, string> | null = (() => {
          const incoming = row.customFieldValues;
          if (!incoming || validCustomFieldIds.size === 0) return null;
          const safe: Record<string, string> = {};
          for (const [k, v] of Object.entries(incoming)) {
            if (validCustomFieldIds.has(k) && v.trim()) safe[k] = v.trim();
          }
          return Object.keys(safe).length > 0 ? safe : null;
        })();

        const newPerson = await tx.person.create({
          data: {
            campaignId,
            householdId: household.id,
            firstName,
            lastName,
            phoneHome:    phoneHome ?? undefined,
            phoneMobile:  phoneMobile ?? undefined,
            email:        email ?? undefined,
            birthYear:    birthYear ?? undefined,
            importSource: importSource.trim() || "voter-list-import",
            wardStatus,
            pollNumber:   pollNumber ?? undefined,
            ...(sanitisedCustomFieldValues ? { customFieldValues: sanitisedCustomFieldValues } : {}),
          },
          select: { id: true },
        });

        await tx.personListMembership.create({
          data: {
            personId:     newPerson.id,
            listImportId: listImportId,
            campaignId,
            status:       "created",
          },
        });

        created++;
      }
    },
    { timeout: 60_000 }
  );

  // Update ListImport with final row counts
  await db.listImport.update({
    where: { id: listImportId },
    data: { matchedCount: matched, newCount: created, reviewCount },
  });

  // Fire and forget — geocode newly created addresses in the background
  if (newAddressIds.length > 0) {
    geocodeNewAddresses(campaignId, newAddressIds).catch(console.error);
  }

  revalidatePath("/voter-import");

  if (created > 0) {
    await createAuditLog({
      campaignId,
      userId: auth.session.user.id,
      action: "VOTER_IMPORT_COMPLETED",
      entityType: "person",
      details: { created, matched, skipped },
    });
  }

  return { matched, created, skipped, reviewCount, flaggedRows };
}

// ── mergePersons ──────────────────────────────────────────────────────────

export async function mergePersons(input: {
  winnerId: string;
  loserId: string;
}): Promise<{ error?: string; ok?: boolean }> {
  const auth = await requireVoterListManager();
  if ("error" in auth) return auth;
  const { session, campaignId } = auth;

  if (input.winnerId === input.loserId) {
    return { error: "Cannot merge a record with itself." };
  }

  const [winner, loser] = await Promise.all([
    db.person.findFirst({
      where: { id: input.winnerId, campaignId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.person.findFirst({
      where: { id: input.loserId, campaignId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, tags: { select: { tagId: true } } },
    }),
  ]);

  if (!winner) return { error: "Winning record not found." };
  if (!loser)  return { error: "Record to merge away not found." };

  const outdatedTag = await db.tag.findFirst({
    where: { name: "record-outdated", deletedAt: null },
    select: { id: true },
  });

  const loserTagIds = loser.tags.map((t) => t.tagId);

  const winnerTags = await db.personTag.findMany({
    where: { personId: input.winnerId, deletedAt: null },
    select: { tagId: true },
  });
  const winnerTagIds = new Set(winnerTags.map((t) => t.tagId));

  await db.$transaction(async (tx) => {
    const tagsToTransfer = loserTagIds.filter((id) => !winnerTagIds.has(id));
    if (tagsToTransfer.length > 0) {
      await tx.personTag.createMany({
        data: tagsToTransfer.map((tagId) => ({
          personId: input.winnerId,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    if (outdatedTag) {
      await tx.personTag.upsert({
        where: {
          personId_tagId: { personId: input.loserId, tagId: outdatedTag.id },
        },
        create: { personId: input.loserId, tagId: outdatedTag.id },
        update: {},
      });
    }

    await tx.person.update({
      where: { id: input.loserId },
      data: { deletedAt: new Date() },
    });

    const loserName = `${loser.firstName} ${loser.lastName}`;
    await tx.note.create({
      data: {
        personId: input.winnerId,
        authorId: session.user.id,
        body: `Record merged: duplicate entry for ${loserName} (ID: ${input.loserId}) was removed and this record was kept as the primary.`,
      },
    });
  });

  await createAuditLog({
    campaignId,
    userId: session.user.id,
    action: "PERSON_MERGED",
    entityType: "person",
    entityId: input.winnerId,
    details: { winnerId: input.winnerId, loserId: input.loserId },
  });

  revalidatePath("/voter-import");
  revalidatePath("/voter-import/duplicates");
  return { ok: true };
}
