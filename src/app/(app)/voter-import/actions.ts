"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageVoterList } from "@/lib/permissions";
import { sanitizePhone, sanitizeEmail, sanitizeBirthDate } from "@/lib/sanitize";
import { createAuditLog } from "@/lib/audit";
import { canAddConstituent } from "@/lib/plan-limits";
import { geocodeNewAddresses } from "@/lib/geocoding";
import { isPointInWard, campaignHasWard } from "@/lib/ward";
import { normalizeFullAddress } from "@/lib/address-normalize";
import { Prisma, WardStatus, ListSource } from "@prisma/client";
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
  birthDate: string;    // empty string when absent; accepts YYYY-MM-DD
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

// ── Shared helpers ────────────────────────────────────────────────────────

function sanitizeCustomFields(
  incoming: Record<string, string> | undefined,
  validIds: Set<string>
): Record<string, string> | null {
  if (!incoming || validIds.size === 0) return null;
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (validIds.has(k) && v.trim()) safe[k] = v.trim();
  }
  return Object.keys(safe).length > 0 ? safe : null;
}

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

      // ── Pre-fetch all existing campaign data ────────────────────────────

      const [existingPeople, existingAddresses, existingHouseholds] = await Promise.all([
        tx.person.findMany({
          where: { campaignId, deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            household: {
              select: {
                id: true,
                addressId: true,
                address: {
                  select: {
                    id: true,
                    streetNumber: true,
                    streetName: true,
                    unitNumber: true,
                    city: true,
                    postalCode: true,
                    lat: true,
                    lng: true,
                  },
                },
              },
            },
          },
        }),
        tx.address.findMany({
          where: { campaignId, deletedAt: null },
          select: {
            id: true,
            streetNumber: true,
            streetName: true,
            unitNumber: true,
            city: true,
            postalCode: true,
            lat: true,
            lng: true,
          },
        }),
        tx.household.findMany({
          where: { campaignId, deletedAt: null },
          select: { id: true, addressId: true },
        }),
      ]);

      // ── Build lookup maps ───────────────────────────────────────────────

      // address key: streetNumber|streetName|unit|postalCode (lowercase)
      const makeAddrKey = (sn: string, st: string, unit: string | null, pc: string) =>
        `${sn.toLowerCase()}|${st.toLowerCase()}|${(unit ?? "").toLowerCase()}|${pc.toLowerCase().replace(/\s/g, "")}`;

      // regular-list person key: firstName|lastName|streetNumber|streetName|unit|postalCode
      const makePersonKey = (fn: string, ln: string, sn: string, st: string, unit: string | null, pc: string) =>
        `${fn.toLowerCase()}|${ln.toLowerCase()}|${sn.toLowerCase()}|${st.toLowerCase()}|${(unit ?? "").toLowerCase()}|${pc.toLowerCase().replace(/\s/g, "")}`;

      // address map: addrKey → { id, lat, lng }
      const addressMap = new Map<string, { id: string; lat: number | null; lng: number | null }>();
      for (const a of existingAddresses) {
        addressMap.set(makeAddrKey(a.streetNumber, a.streetName, a.unitNumber, a.postalCode), {
          id: a.id,
          lat: a.lat,
          lng: a.lng,
        });
      }

      // household map: addressId → householdId
      const householdMap = new Map<string, string>();
      for (const h of existingHouseholds) {
        householdMap.set(h.addressId, h.id);
      }

      type OvlStub = {
        id: string;
        firstNameLower: string;
        lastNameLower: string;
        normAddr: string | null;
        unitLower: string;
      };

      // Regular-list person map: personKey → personId
      const personByNameAddr = new Map<string, string>();

      // OVL lookup maps
      const ovlByNormName   = new Map<string, OvlStub[]>(); // "normFirst|normLast" → stubs
      const ovlByStreetCity = new Map<string, OvlStub[]>(); // "streetNumber|city" → stubs

      for (const p of existingPeople) {
        const addr = p.household?.address;
        const fnLower = p.firstName.toLowerCase();
        const lnLower = p.lastName.toLowerCase();

        // Regular-list lookup
        if (addr) {
          personByNameAddr.set(
            makePersonKey(p.firstName, p.lastName, addr.streetNumber, addr.streetName, addr.unitNumber, addr.postalCode),
            p.id
          );
        }

        // OVL stubs
        const normAddr = addr
          ? normalizeFullAddress(`${addr.streetNumber} ${addr.streetName}`, addr.city)
          : null;
        const stub: OvlStub = {
          id: p.id,
          firstNameLower: fnLower,
          lastNameLower: lnLower,
          normAddr,
          unitLower: (addr?.unitNumber ?? "").toLowerCase().trim(),
        };

        const nameKey = `${fnLower}|${lnLower}`;
        const nameList = ovlByNormName.get(nameKey);
        if (nameList) nameList.push(stub);
        else ovlByNormName.set(nameKey, [stub]);

        if (addr) {
          const scKey = `${addr.streetNumber.toLowerCase()}|${addr.city.toLowerCase()}`;
          const scList = ovlByStreetCity.get(scKey);
          if (scList) scList.push(stub);
          else ovlByStreetCity.set(scKey, [stub]);
        }
      }

      // ── Write accumulators ──────────────────────────────────────────────

      type AddrRow = {
        id: string; campaignId: string;
        streetNumber: string; streetName: string; unitNumber: string | null;
        city: string; province: string; postalCode: string;
      };
      type HouseholdRow = { id: string; campaignId: string; addressId: string };

      const newAddressRows:    AddrRow[]                                  = [];
      const newHouseholdRows:  HouseholdRow[]                             = [];
      const newPersonRows:     Prisma.PersonCreateManyInput[]             = [];
      const newMembershipRows: Prisma.PersonListMembershipCreateManyInput[] = [];
      const personUpdateOps:   Array<{ id: string; isConfirmedVoter: true; pollNumber?: string }> = [];

      // ── Address / household helpers ─────────────────────────────────────

      function getOrStageAddress(
        sn: string, st: string, unit: string | null,
        city: string, province: string, pc: string
      ): { id: string; lat: number | null; lng: number | null } {
        const key = makeAddrKey(sn, st, unit, pc);
        const hit = addressMap.get(key);
        if (hit) return hit;
        const id = crypto.randomUUID();
        newAddressRows.push({ id, campaignId, streetNumber: sn, streetName: st, unitNumber: unit, city, province, postalCode: pc });
        newAddressIds.push(id);
        const entry = { id, lat: null as null, lng: null as null };
        addressMap.set(key, entry);
        return entry;
      }

      function getOrStageHousehold(addressId: string): string {
        const hit = householdMap.get(addressId);
        if (hit) return hit;
        const id = crypto.randomUUID();
        newHouseholdRows.push({ id, campaignId, addressId });
        householdMap.set(addressId, id);
        return id;
      }

      // ── Main loop ───────────────────────────────────────────────────────

      for (const row of rows) {
        const firstName    = row.firstName.trim();
        const lastName     = row.lastName.trim();
        const streetNumber = row.streetNumber.trim();
        const streetName   = row.streetName.trim();
        const city         = row.city.trim();
        const province     = row.province.trim();
        const postalCode   = row.postalCode.trim().replace(/\s/g, "").toUpperCase();
        const unitNumber   = row.unitNumber?.trim() || null;
        const phoneHome    = sanitizePhone(row.phoneHome);
        const phoneMobile  = sanitizePhone(row.phoneMobile);
        const email        = sanitizeEmail(row.email);
        const birthDate    = sanitizeBirthDate(row.birthDate);
        const pollNumber   = row.pollNumber?.trim() || null;

        if (!firstName || !lastName || !streetNumber || !streetName || !city || !province || !postalCode) {
          skipped++;
          continue;
        }

        // ── Official Voters List matching ─────────────────────────────────

        if (listImportType === "official_voters_list") {
          // Normalize name: take first and last token so "JOHN MICHAEL SMITH" → "john" / "smith"
          const nameTokens = `${firstName} ${lastName}`.trim().split(/\s+/).filter(Boolean);
          const normFirst  = (nameTokens[0] ?? firstName).toLowerCase();
          const normLast   = (nameTokens.length > 1 ? nameTokens[nameTokens.length - 1] : lastName).toLowerCase();

          const incomingAddrKey = normalizeFullAddress(`${streetNumber} ${streetName}`, city);
          const incomingUnit    = (unitNumber ?? "").toLowerCase().trim();

          // Pull candidates from in-memory indexes (replaces two per-row findMany calls)
          const nameKey = `${normFirst}|${normLast}`;
          const scKey   = `${streetNumber.toLowerCase()}|${city.toLowerCase()}`;
          const seen    = new Set<string>();
          const allCandidates: OvlStub[] = [];
          for (const s of [...(ovlByNormName.get(nameKey) ?? []), ...(ovlByStreetCity.get(scKey) ?? [])]) {
            if (!seen.has(s.id)) { seen.add(s.id); allCandidates.push(s); }
          }

          type MatchKind = "full" | "unit_mismatch" | "name_only" | "addr_only";
          const priority: Record<MatchKind, number> = { full: 0, unit_mismatch: 1, name_only: 2, addr_only: 2 };
          let bestKind: MatchKind | null = null;
          let bestCandidateId: string | null = null;

          for (const stub of allCandidates) {
            const nameMatch = stub.firstNameLower === normFirst && stub.lastNameLower === normLast;
            const addrMatch = stub.normAddr !== null && stub.normAddr === incomingAddrKey;
            const unitMatch = stub.unitLower === incomingUnit;

            let kind: MatchKind | null = null;
            if      (nameMatch && addrMatch && unitMatch) kind = "full";
            else if (nameMatch && addrMatch)              kind = "unit_mismatch";
            else if (nameMatch)                           kind = "name_only";
            else if (addrMatch)                           kind = "addr_only";

            if (kind && (bestKind === null || priority[kind] < priority[bestKind])) {
              bestKind = kind;
              bestCandidateId = stub.id;
            }
            if (bestKind === "full") break;
          }

          if (bestKind === "full" && bestCandidateId) {
            matched++;
            personUpdateOps.push({
              id: bestCandidateId,
              isConfirmedVoter: true,
              ...(pollNumber ? { pollNumber } : {}),
            });
            newMembershipRows.push({ personId: bestCandidateId, listImportId, campaignId, status: "matched" });

          } else if (bestKind !== null && bestCandidateId) {
            reviewCount++;
            const reviewReason =
              bestKind === "unit_mismatch" ? "Same address, different unit" :
              bestKind === "name_only"     ? "Name matches, address differs" :
                                             "Address matches, name differs";
            newMembershipRows.push({ personId: bestCandidateId, listImportId, campaignId, status: "pending_review", reviewReason });

          } else {
            // No match — create a new confirmed-voter record
            const ovlAddr      = getOrStageAddress(streetNumber, streetName, unitNumber, city, province, postalCode);
            const householdId  = getOrStageHousehold(ovlAddr.id);
            const personId     = crypto.randomUUID();
            const cfv          = sanitizeCustomFields(row.customFieldValues, validCustomFieldIds);

            newPersonRows.push({
              id: personId,
              campaignId,
              householdId,
              firstName,
              lastName,
              phoneHome:        phoneHome   ?? undefined,
              phoneMobile:      phoneMobile ?? undefined,
              email:            email       ?? undefined,
              birthDate:        birthDate   ?? undefined,
              importSource:     "Official Voters List",
              isConfirmedVoter: true,
              listSource:       ListSource.voters_list,
              pollNumber:       pollNumber ?? undefined,
              ...(cfv ? { customFieldValues: cfv as Prisma.InputJsonValue } : {}),
            });
            newMembershipRows.push({ personId, listImportId, campaignId, status: "created" });

            // Index the new person so a second OVL row for the same person gets matched
            const newNormAddr = normalizeFullAddress(`${streetNumber} ${streetName}`, city);
            const newStub: OvlStub = {
              id: personId,
              firstNameLower: firstName.toLowerCase(),
              lastNameLower:  lastName.toLowerCase(),
              normAddr: newNormAddr,
              unitLower: (unitNumber ?? "").toLowerCase().trim(),
            };
            const nk = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
            const nkList = ovlByNormName.get(nk);
            if (nkList) nkList.push(newStub); else ovlByNormName.set(nk, [newStub]);
            const sk = `${streetNumber.toLowerCase()}|${city.toLowerCase()}`;
            const skList = ovlByStreetCity.get(sk);
            if (skList) skList.push(newStub); else ovlByStreetCity.set(sk, [newStub]);

            created++;
          }

          continue; // skip regular-list logic below
        }

        // ── Regular list matching ─────────────────────────────────────────

        // 1. Match existing person by name + address (in-memory lookup)
        const pKey            = makePersonKey(firstName, lastName, streetNumber, streetName, unitNumber, postalCode);
        const existingPersonId = personByNameAddr.get(pKey);

        if (existingPersonId) {
          matched++;
          newMembershipRows.push({ personId: existingPersonId, listImportId, campaignId, status: "matched" });
          continue;
        }

        // 2. Find or stage address
        const addrEntry = getOrStageAddress(streetNumber, streetName, unitNumber, city, province, postalCode);

        // 3. Ward boundary check (only possible when address is already geocoded)
        let wardStatus: WardStatus = WardStatus.not_checked;
        if (wardBoundary && addrEntry.lat !== null && addrEntry.lng !== null) {
          wardStatus = isPointInWard(addrEntry.lat, addrEntry.lng, wardBoundary)
            ? WardStatus.inside
            : WardStatus.outside;
        }

        if (wardStatus === WardStatus.outside) {
          flaggedRows.push({ firstName, lastName, streetNumber, streetName, unitNumber, city, province, postalCode, wardStatus: "outside" });
          continue;
        }

        // 4. Find or stage household
        const householdId = getOrStageHousehold(addrEntry.id);

        // 5. Stage person create
        const personId = crypto.randomUUID();
        const cfv      = sanitizeCustomFields(row.customFieldValues, validCustomFieldIds);

        newPersonRows.push({
          id: personId,
          campaignId,
          householdId,
          firstName,
          lastName,
          phoneHome:    phoneHome   ?? undefined,
          phoneMobile:  phoneMobile ?? undefined,
          email:        email       ?? undefined,
          birthDate:    birthDate   ?? undefined,
          importSource: importSource.trim() || "voter-list-import",
          wardStatus,
          listSource:   ListSource.residents_list,
          pollNumber:   pollNumber ?? undefined,
          ...(cfv ? { customFieldValues: cfv as Prisma.InputJsonValue } : {}),
        });
        newMembershipRows.push({ personId, listImportId, campaignId, status: "created" });

        // Keep lookup map current so a duplicate row in the same import is treated as a match
        personByNameAddr.set(pKey, personId);
        created++;
      }

      // ── Batch writes (dependency order: address → household → person → membership) ──

      if (newAddressRows.length > 0) {
        await tx.address.createMany({ data: newAddressRows });
      }
      if (newHouseholdRows.length > 0) {
        await tx.household.createMany({ data: newHouseholdRows });
      }
      if (newPersonRows.length > 0) {
        await tx.person.createMany({ data: newPersonRows });
      }
      if (newMembershipRows.length > 0) {
        await tx.personListMembership.createMany({ data: newMembershipRows });
      }
      if (personUpdateOps.length > 0) {
        await Promise.all(
          personUpdateOps.map(({ id, isConfirmedVoter, pollNumber }) =>
            tx.person.update({
              where: { id },
              data: { isConfirmedVoter, ...(pollNumber !== undefined ? { pollNumber } : {}) },
            })
          )
        );
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
