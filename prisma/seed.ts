/**
 * Seed script for LocalSeat — foundation + address structure.
 *
 * Creates:
 *   - 1 campaign (Greenfield Ward 3 — 2026)
 *   - 13 users across all roles (password: "password")
 *   - 6 system/user-facing tags
 *   - 555 addresses across 16 streets
 *   - 555 households (100×1 + 200×2 + 100×3 + 75×4 + 80×5)
 *   - 1500 placeholder voter records
 *
 * Run: npm run db:seed
 */

import { PrismaClient, SupportLevel, CanvassOutcome, DonorStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const HASH = bcrypt.hashSync("password", 12);
const VERIFIED = new Date();

// ── Cultural name pools ───────────────────────────────────────────────────────
// Each group has a first-name pool and a last-name pool.
// Household members share the same last name (family unit).
// First names are picked per-person with an offset to avoid repeats in a household.

const GROUPS = [
  {
    // English — 30% of households (cycle positions 0-29)
    first: ["James","William","Thomas","Robert","David","Michael","John","Richard","Charles","George","Mary","Patricia","Linda","Barbara","Elizabeth","Jennifer","Susan","Margaret","Dorothy","Helen","Daniel","Matthew","Andrew","Joshua","Ryan","Emma","Olivia","Sophia","Charlotte","Grace"],
    last:  ["Smith","Johnson","Brown","Wilson","Taylor","Anderson","Thomas","Martin","White","Harris"],
  },
  {
    // French — 20% (positions 30-49)
    first: ["Jean","Pierre","Michel","François","Philippe","André","Louis","Jacques","Henri","Luc","Marie","Isabelle","Sophie","Camille","Amélie","Claire","Nathalie","Céline","Monique","Brigitte"],
    last:  ["Tremblay","Gagnon","Roy","Côté","Bouchard","Lavoie","Fortin","Gauthier","Morin","Pelletier"],
  },
  {
    // South Asian — 20% (positions 50-69)
    first: ["Rahul","Arjun","Vikram","Suresh","Rajesh","Amit","Priya","Anjali","Deepa","Sunita","Neha","Pooja","Kavya","Ravi","Anil","Sanjay","Meera","Divya","Kiran","Manish"],
    last:  ["Patel","Singh","Kumar","Sharma","Jain","Shah","Mehta","Gupta","Verma","Agarwal"],
  },
  {
    // East Asian — 15% (positions 70-84)
    first: ["Wei","Ming","Jun","Fang","Yan","Hui","Lin","Ying","Hong","Xiao","Jing","Tao","Yong","Feng","Lei","Na","Hua","Bo","Chen","Li"],
    last:  ["Chen","Wang","Li","Zhang","Liu","Huang","Wu","Yang","Zhou","Xu"],
  },
  {
    // African — 15% (positions 85-99)
    first: ["Kwame","Kofi","Emeka","Chidi","Tunde","Yaw","Ade","Bayo","Seun","Dele","Amara","Nkechi","Fatima","Zainab","Aisha","Yewande","Folake","Ngozi","Chiamaka","Abena"],
    last:  ["Okafor","Mensah","Diallo","Nkosi","Owusu","Adeyemi","Ibrahim","Kamara","Diop","Asante"],
  },
];

// 100-element cycle → English 30%, French 20%, South Asian 20%, East Asian 15%, African 15%
function culturalGroup(hhIdx: number) {
  const pos = hhIdx % 100;
  if (pos < 30) return GROUPS[0];
  if (pos < 50) return GROUPS[1];
  if (pos < 70) return GROUPS[2];
  if (pos < 85) return GROUPS[3];
  return GROUPS[4];
}

// ── Support level distribution (first 900 of 1500 voters) ────────────────────
// Boundaries: 225 strong_yes | 405 soft_yes | 630 undecided | 765 soft_no | 855 strong_no | 900 not_home
function supportLevel(personIdx: number): string | null {
  if (personIdx <  225) return "strong_yes";
  if (personIdx <  405) return "soft_yes";
  if (personIdx <  630) return "undecided";
  if (personIdx <  765) return "soft_no";
  if (personIdx <  855) return "strong_no";
  if (personIdx <  900) return "not_home";
  return null;
}

// ── Phone number helpers ──────────────────────────────────────────────────────
// Deterministic but varied — large prime multiplier ensures good distribution
function phoneHome(personIdx: number): string | null {
  if (personIdx >= 800) return null;
  const xxxx = String(1000 + ((personIdx * 7919 + 3141) % 9000));
  return `(519) 555-${xxxx}`;
}

function phoneMobile(personIdx: number): string | null {
  if (personIdx >= 300) return null;
  const xxxx = String(1000 + ((personIdx * 6271 + 2718) % 9000));
  return `(416) 555-${xxxx}`;
}

async function main() {
  console.log("🌱 Seeding database...");

  // ── Cleanup (FK-safe order) ───────────────────────────────────────────────
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.volunteerShiftAttendee.deleteMany(),
    db.volunteerShift.deleteMany(),
    db.volunteerRecord.deleteMany(),
    db.donor.deleteMany(),
    db.outreachLog.deleteMany(),
    db.canvassResponse.deleteMany(),
    db.canvassAssignment.deleteMany(),
    db.canvassListEntry.deleteMany(),
    db.canvassList.deleteMany(),
    db.task.deleteMany(),
    db.note.deleteMany(),
    db.personTag.deleteMany(),
    db.tag.deleteMany(),
    db.addressChangeRequest.deleteMany(),
    db.person.deleteMany(),
    db.household.deleteMany(),
    db.address.deleteMany(),
    db.campaignMembership.deleteMany(),
    db.campaign.deleteMany(),
    db.user.deleteMany(),
  ]);
  console.log("  ✓ Cleaned up existing data");

  // ── Campaign ──────────────────────────────────────────────────────────────
  const campaign = await db.campaign.create({
    data: {
      name:         "Greenfield Ward 3 — 2026",
      ballotName:   "Alex Chen",
      officeSought: "Ward 3 Councillor",
      description:  "Municipal election campaign for Ward 3, Greenfield, Ontario. Focus on affordable housing, active transportation, and neighbourhood safety.",
      municipality: "Greenfield",
      wards:        ["Ward 3"],
      city:         "Greenfield",
      province:     "ON",
      year:         2026,
      electionDate: new Date("2026-10-26T00:00:00.000Z"),
      isActive:     true,
    },
  });
  console.log(`  ✓ Campaign: ${campaign.name}`);

  // ── Users ─────────────────────────────────────────────────────────────────
  const [
    alexChen,
    mariaSantos,
    jamesOkafor,
    sarahKim,
    claireMorgan,
    robertBell,
    danWu,
    saraBishop,
    priyaNair,
    kevinLafleur,
    amyZhang,
    tomOkonkwo,
  ] = await Promise.all([
    db.user.create({ data: { email: "alex.chen@example.com",    passwordHash: HASH, firstName: "Alex",   lastName: "Chen",     phoneHome: "613-555-0100", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "maria.santos@example.com", passwordHash: HASH, firstName: "Maria",  lastName: "Santos",   phoneHome: "613-555-0101", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "james.okafor@example.com", passwordHash: HASH, firstName: "James",  lastName: "Okafor",   phoneHome: "613-555-0102", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "sarah.kim@example.com",    passwordHash: HASH, firstName: "Sarah",  lastName: "Kim",      phoneHome: "613-555-0103", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "claire.morgan@example.com",passwordHash: HASH, firstName: "Claire", lastName: "Morgan",   phoneHome: "613-555-0104", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "robert.bell@example.com",  passwordHash: HASH, firstName: "Robert", lastName: "Bell",     phoneHome: "613-555-0105", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "dan.wu@example.com",       passwordHash: HASH, firstName: "Dan",    lastName: "Wu",       phoneHome: "613-555-0106", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "sara.bishop@example.com",  passwordHash: HASH, firstName: "Sara",   lastName: "Bishop",   phoneHome: "613-555-0107", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "priya.nair@example.com",   passwordHash: HASH, firstName: "Priya",  lastName: "Nair",     phoneHome: "613-555-0108", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "kevin.lafleur@example.com",passwordHash: HASH, firstName: "Kevin",  lastName: "Lafleur",  phoneHome: "613-555-0109", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "amy.zhang@example.com",    passwordHash: HASH, firstName: "Amy",    lastName: "Zhang",    phoneHome: "613-555-0110", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "tom.okonkwo@example.com",  passwordHash: HASH, firstName: "Tom",    lastName: "Okonkwo",  phoneHome: "613-555-0111", emailVerified: VERIFIED } }),
  ]);

  // Platform superuser — upsert so it survives repeated seeds
  await db.user.upsert({
    where:  { email: "superuser@localseat.io" },
    create: { email: "superuser@localseat.io", passwordHash: HASH, firstName: "Super", lastName: "User", isActive: true, platformRole: "super_user", emailVerified: VERIFIED },
    update: { passwordHash: HASH, platformRole: "super_user", emailVerified: VERIFIED },
  });
  console.log("  ✓ Users: 13 (including platform superuser)");

  // ── Campaign memberships ──────────────────────────────────────────────────
  await db.campaignMembership.createMany({
    data: [
      { userId: alexChen.id,     campaignId: campaign.id, role: "candidate"            },
      { userId: mariaSantos.id,  campaignId: campaign.id, role: "campaign_manager"     },
      { userId: jamesOkafor.id,  campaignId: campaign.id, role: "field_organizer"      },
      { userId: sarahKim.id,     campaignId: campaign.id, role: "field_organizer"      },
      { userId: claireMorgan.id, campaignId: campaign.id, role: "co_chair"             },
      { userId: robertBell.id,   campaignId: campaign.id, role: "co_chair"             },
      { userId: danWu.id,        campaignId: campaign.id, role: "finance_lead"         },
      { userId: saraBishop.id,   campaignId: campaign.id, role: "volunteer_coordinator"},
      { userId: priyaNair.id,    campaignId: campaign.id, role: "canvasser"            },
      { userId: kevinLafleur.id, campaignId: campaign.id, role: "canvasser"            },
      { userId: amyZhang.id,     campaignId: campaign.id, role: "canvasser"            },
      { userId: tomOkonkwo.id,   campaignId: campaign.id, role: "canvasser"            },
    ],
  });
  console.log("  ✓ Campaign memberships: 12");

  // ── Tags ──────────────────────────────────────────────────────────────────
  await db.tag.createMany({
    data: [
      { name: "field-entry",       color: "#475569" }, // system — auto-applied on canvass import
      { name: "record-outdated",   color: "#dc2626" }, // system — applied on merge/deduplicate
      { name: "strong-supporter",  color: "#16a34a" },
      { name: "needs-sign",        color: "#2563eb" },
      { name: "volunteer-interest",color: "#7c3aed" },
      { name: "donor-prospect",    color: "#ea6c0a" },
    ],
  });
  console.log("  ✓ Tags: 6");

  // ── Streets, addresses, households, placeholder voters ───────────────────
  //
  // 16 streets, 25 households each = 400 households total.
  // House numbers: even side only (2, 4, 6, … 50).
  //
  // Household size pattern — 10-element cycle that yields exactly:
  //   120 single-person, 160 two-person, 80 three-person, 40 four-person
  // per 400 households (40 complete cycles).
  //   Pattern [1,2,2,3,1,2,4,1,3,2] → 3 singles + 4 twos + 2 threes + 1 four
  //   per cycle → 840 total persons across 400 households.

  const STREETS: { name: string; postalCode: string; poll: string }[] = [
    { name: "Elm Street",       postalCode: "K1A 1A1", poll: "Poll 1" },
    { name: "Maple Avenue",     postalCode: "K1A 1B2", poll: "Poll 1" },
    { name: "Oak Drive",        postalCode: "K1B 2A1", poll: "Poll 2" },
    { name: "Cedar Boulevard",  postalCode: "K1B 2B2", poll: "Poll 2" },
    { name: "Birch Lane",       postalCode: "K1C 3A1", poll: "Poll 3" },
    { name: "Pine Crescent",    postalCode: "K1C 3B2", poll: "Poll 3" },
    { name: "Willow Court",     postalCode: "K1D 4A1", poll: "Poll 4" },
    { name: "Spruce Road",      postalCode: "K1D 4B2", poll: "Poll 4" },
    { name: "Chestnut Drive",   postalCode: "K1E 5A1", poll: "Poll 5" },
    { name: "Walnut Avenue",    postalCode: "K1E 5B2", poll: "Poll 5" },
    { name: "Poplar Street",    postalCode: "K1F 6A1", poll: "Poll 6" },
    { name: "Ash Court",        postalCode: "K1F 6B2", poll: "Poll 6" },
    { name: "Linden Boulevard", postalCode: "K1G 7A1", poll: "Poll 7" },
    { name: "Hawthorn Lane",    postalCode: "K1G 7B2", poll: "Poll 7" },
    { name: "Sycamore Road",    postalCode: "K1H 8A1", poll: "Poll 8" },
    { name: "Beech Street",     postalCode: "K1H 8B2", poll: "Poll 8" },
  ];

  // Household sizes by global index — direct boundary approach, no cycle needed.
  // 100 single + 200 two + 100 three + 75 four + 80 five = 555 HH, 1500 voters exactly.
  function hhSize(idx: number): number {
    if (idx <  100) return 1; // 100 × 1 = 100
    if (idx <  300) return 2; // 200 × 2 = 400
    if (idx <  400) return 3; // 100 × 3 = 300
    if (idx <  475) return 4; //  75 × 4 = 300
    return               5;   //  80 × 5 = 400
  }

  // 555 addresses across 16 streets: 11 streets × 35 + 5 streets × 34 = 555
  // House numbers: even side (2, 4, 6, …)
  const HOUSES_PER_STREET = [35,35,35,35,35,35,35,35,35,35,35,34,34,34,34,34];

  const addressRows = STREETS.flatMap((street, si) =>
    Array.from({ length: HOUSES_PER_STREET[si] }, (_, i) => ({
      campaignId:   campaign.id,
      streetNumber: String((i + 1) * 2),
      streetName:   street.name,
      city:         "Greenfield",
      province:     "ON",
      postalCode:   street.postalCode,
    }))
  );

  const addresses = await db.address.createManyAndReturn({ data: addressRows });
  console.log(`  ✓ Addresses: ${addresses.length}`);

  const householdRows = addresses.map((addr) => ({
    campaignId: campaign.id,
    addressId:  addr.id,
  }));

  const households = await db.household.createManyAndReturn({ data: householdRows });
  console.log(`  ✓ Households: ${households.length}`);

  // Accumulate per-street address counts for poll number lookup
  const streetStartIdx: number[] = [];
  let runningIdx = 0;
  HOUSES_PER_STREET.forEach((count) => {
    streetStartIdx.push(runningIdx);
    runningIdx += count;
  });

  const personRows: {
    campaignId:    string;
    householdId:   string;
    firstName:     string;
    lastName:      string;
    pollNumber:    string;
    importSource:  string;
    supportLevel?: string;
    phoneHome?:    string;
    phoneMobile?:  string;
  }[] = [];

  households.forEach((hh, hhIdx) => {
    // Determine which street this household belongs to
    const streetIdx = HOUSES_PER_STREET.reduce((found, count, si) => {
      return hhIdx >= streetStartIdx[si] && hhIdx < streetStartIdx[si] + count ? si : found;
    }, 0);
    const poll  = STREETS[streetIdx].poll;
    const size  = hhSize(hhIdx);
    const group = culturalGroup(hhIdx);

    // All members share the household's last name (family unit)
    const lastName = group.last[hhIdx % group.last.length];

    for (let p = 0; p < size; p++) {
      // hhIdx * 7 spreads picks across the pool (7 is coprime with pool sizes 20 and 30)
      // + p ensures different first names within the same household
      const firstName = group.first[(hhIdx * 7 + p) % group.first.length];
      const pIdx = personRows.length;
      const sl   = supportLevel(pIdx);
      const ph   = phoneHome(pIdx);
      const pm   = phoneMobile(pIdx);
      personRows.push({
        campaignId:   campaign.id,
        householdId:  hh.id,
        firstName,
        lastName,
        pollNumber:   poll,
        importSource: "2022 Municipal Voter List",
        ...(sl ? { supportLevel: sl } : {}),
        ...(ph ? { phoneHome:    ph } : {}),
        ...(pm ? { phoneMobile:  pm } : {}),
      });
    }
  });

  await db.person.createMany({ data: personRows });
  console.log(`  ✓ Placeholder voters: ${personRows.length}`);

  // ── Walk lists, assignments, entries, canvass responses ───────────────────
  const NOTE_POOL = [
    "Very supportive, wants sign",
    "Concerned about traffic",
    "Moving next month",
    "Already voted advance",
    "Wants to volunteer",
    "Not interested",
    "Will consider",
    "Requested more info",
  ];

  function randomRespondedAt(): Date {
    const d = new Date(Date.now() - Math.random() * 21 * 24 * 60 * 60 * 1000);
    d.setHours(9 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60), 0, 0);
    return d;
  }

  const WALK_LIST_DEFS = [
    {
      name:           "Elm Street Block — Round 1",
      description:    "Initial door knock on Elm Street between 14 and 32",
      street:         "Elm Street",
      canvasser:      priyaNair,
      totalEntries:   40,
      completedCount: 24,
    },
    {
      name:           "Maple Avenue North",
      description:    "Maple Avenue north end canvass",
      street:         "Maple Avenue",
      canvasser:      kevinLafleur,
      totalEntries:   35,
      completedCount: 14,
    },
    {
      name:           "Oak Drive Circuit",
      description:    "Full Oak Drive sweep",
      street:         "Oak Drive",
      canvasser:      amyZhang,
      totalEntries:   45,
      completedCount:  9,
    },
    {
      name:           "Cedar Boulevard Run",
      description:    "Cedar Boulevard first pass",
      street:         "Cedar Boulevard",
      canvasser:      tomOkonkwo,
      totalEntries:   30,
      completedCount:  0,
    },
  ];

  let totalResponses = 0;

  for (let listIdx = 0; listIdx < WALK_LIST_DEFS.length; listIdx++) {
    const def = WALK_LIST_DEFS[listIdx];
    // Fetch persons from this street (capped at totalEntries)
    const streetPersons = await db.person.findMany({
      where: {
        campaignId: campaign.id,
        household:  { address: { streetName: def.street } },
      },
      take: def.totalEntries,
    });

    const canvassList = await db.canvassList.create({
      data: {
        campaignId:  campaign.id,
        name:        def.name,
        description: def.description,
      },
    });

    const assignment = await db.canvassAssignment.create({
      data: {
        canvassListId: canvassList.id,
        canvasserId:   def.canvasser.id,
      },
    });

    await db.canvassListEntry.createMany({
      data: streetPersons.map((p) => ({
        canvassListId: canvassList.id,
        personId:      p.id,
        addedById:     jamesOkafor.id,
      })),
    });

    const completedPersons = streetPersons.slice(0, def.completedCount);
    if (completedPersons.length > 0) {
      await db.canvassResponse.createMany({
        data: completedPersons.map((p, ri) => {
          const sl      = p.supportLevel as SupportLevel | null;
          const outcome = sl === "not_home"
            ? CanvassOutcome.not_home
            : CanvassOutcome.contacted;
          const note    = ri % 10 < 3
            ? NOTE_POOL[(listIdx * 3 + ri) % NOTE_POOL.length]
            : undefined;
          return {
            assignmentId: assignment.id,
            personId:     p.id,
            outcome,
            ...(sl && sl !== "not_home" ? { supportLevel: sl as SupportLevel } : {}),
            respondedAt:  randomRespondedAt(),
            ...(note ? { notes: note } : {}),
          };
        }),
      });
      totalResponses += completedPersons.length;
    }

    console.log(
      `  ✓ "${def.name}": ${streetPersons.length} entries, ${completedPersons.length} responses`
    );
  }
  console.log(`  ✓ Walk lists: 4 | Canvass responses: ${totalResponses}`);

  // ── Follow-up tasks ───────────────────────────────────────────────────────
  const FOLLOW_UP_NOTES = [
    "Call back after 6pm",
    "Wants to volunteer",
    "Request for lawn sign",
    "Follow up on noise complaint concern",
    "Interested in donating",
    "Wants candidate to visit street",
    "Needs sign removal after election",
    "Strong supporter — ask to bring friends",
  ];

  const followUpPersons = await db.person.findMany({
    where: { campaignId: campaign.id },
    take: 30,
    skip: 10,
  });

  const followUpAssignees = [jamesOkafor, sarahKim, priyaNair, kevinLafleur];
  const nowMs          = Date.now();
  const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;
  const TWO_WEEKS_MS   = 14 * 24 * 60 * 60 * 1000;

  await db.task.createMany({
    data: followUpPersons.map((p, i) => {
      const isCompleted = i >= 15;
      const assignee    = followUpAssignees[i % followUpAssignees.length];
      const createdAt   = new Date(nowMs - Math.random() * THREE_WEEKS_MS);
      const completedAt = isCompleted
        ? new Date(nowMs - Math.random() * TWO_WEEKS_MS)
        : null;
      return {
        campaignId: campaign.id,
        personId:   p.id,
        assignedTo: assignee.id,
        title:      FOLLOW_UP_NOTES[i % FOLLOW_UP_NOTES.length],
        notes:      FOLLOW_UP_NOTES[i % FOLLOW_UP_NOTES.length],
        completed:  isCompleted,
        createdAt,
        ...(completedAt ? { completedAt } : {}),
      };
    }),
  });
  console.log("  ✓ Follow-up tasks: 30 (15 open, 15 completed)");

  // ── Donor prospects ───────────────────────────────────────────────────────
  // Status distribution: 8 interested · 5 pledged · 4 received · 3 thanked
  // "thanked" maps to received + thankYouSent: true (no separate enum value)
  const donorPersons = await db.person.findMany({
    where: { campaignId: campaign.id },
    take: 20,
    skip: 50,
  });

  const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

  const DONOR_NOTES: (string | null)[] = [
    null, null, null, null, null, null, null, null,    // 8 interested
    "Pledged at door", "Pledged at door", "Pledged at door", "Pledged at door", "Pledged at door", // 5 pledged
    "E-transfer received", "E-transfer received", "Cheque by mail", "Cheque by mail",              // 4 received
    "E-transfer received", "Cheque by mail", "E-transfer received",                                // 3 thanked
  ];

  await db.donor.createMany({
    data: donorPersons.map((p, i) => {
      const isReceived = i >= 13;
      const isThanked  = i >= 17;
      const status     = i < 8  ? DonorStatus.interested
                       : i < 13 ? DonorStatus.pledged
                       :           DonorStatus.received;
      const createdAt  = new Date(nowMs - Math.random() * FOUR_WEEKS_MS);
      const amount     = 50 + Math.floor(Math.random() * 701); // $50–$750
      return {
        campaignId:    campaign.id,
        firstName:     p.firstName,
        lastName:      p.lastName,
        ...(p.phoneHome ? { phoneHome: p.phoneHome } : {}),
        linkedPersonId: p.id,
        createdById:   danWu.id,
        status,
        amount,
        ...(isReceived ? { donationDate: createdAt } : {}),
        thankYouSent:  isThanked,
        ...(isThanked  ? { thankYouDate: new Date(nowMs - Math.random() * 7 * 24 * 60 * 60 * 1000) } : {}),
        ...(DONOR_NOTES[i] ? { notes: DONOR_NOTES[i]! } : {}),
        createdAt,
      };
    }),
  });
  console.log("  ✓ Donor prospects: 20 (8 interested, 5 pledged, 4 received, 3 thanked)");

  // ── Volunteer shifts ──────────────────────────────────────────────────────
  // Dates relative to today 2026-04-19 (Sunday):
  //   Shift 1 — last Saturday Apr 18 (already happened → attended)
  //   Shift 2 — next Tuesday  Apr 21 (pending)
  //   Shift 3 — next Saturday Apr 25
  //   Shift 4 — following Sat May 02
  //   Shift 5 — Saturday before election Oct 24
  const SHIFT_DEFS = [
    { name: "Saturday Canvass — Elm Street", date: new Date("2026-04-18T00:00:00Z"), startTime: "09:00", endTime: "13:00", maxVolunteers:  8 },
    { name: "Phone Banking Evening",         date: new Date("2026-04-21T00:00:00Z"), startTime: "18:00", endTime: "21:00", maxVolunteers:  6 },
    { name: "Sign Installation",             date: new Date("2026-04-25T00:00:00Z"), startTime: "10:00", endTime: "14:00", maxVolunteers: 10 },
    { name: "Voter Contact Blitz",           date: new Date("2026-05-02T00:00:00Z"), startTime: "09:00", endTime: "12:00", maxVolunteers:  8 },
    { name: "Final Push Canvass",            date: new Date("2026-10-24T00:00:00Z"), startTime: "08:00", endTime: "17:00", maxVolunteers: 15 },
  ];

  const shifts = await Promise.all(
    SHIFT_DEFS.map((s) =>
      db.volunteerShift.create({
        data: {
          campaignId:    campaign.id,
          name:          s.name,
          date:          s.date,
          startTime:     s.startTime,
          endTime:       s.endTime,
          maxVolunteers: s.maxVolunteers,
        },
      })
    )
  );

  // Volunteer records: use 5 voters who were canvassed
  const volPersons = await db.person.findMany({
    where: { campaignId: campaign.id },
    take: 5,
    skip: 100,
  });

  const volRecords = await Promise.all(
    volPersons.map((p) =>
      db.volunteerRecord.create({
        data: {
          campaignId: campaign.id,
          personId:   p.id,
          status:     "committed",
        },
      })
    )
  );

  // Shift 1 (past): 4 volunteers, attended
  // Shift 2 (upcoming): 3 volunteers, pending
  await db.volunteerShiftAttendee.createMany({
    data: [
      ...volRecords.slice(0, 4).map((r) => ({
        shiftId:  shifts[0].id,
        recordId: r.id,
        status:   "attended" as const,
      })),
      ...volRecords.slice(0, 3).map((r) => ({
        shiftId:  shifts[1].id,
        recordId: r.id,
        status:   "pending" as const,
      })),
    ],
  });

  console.log("  ✓ Volunteer shifts: 5 (4 attended shift 1, 3 pending shift 2)");

  console.log("\n✅ Foundation seed complete.\n");
  console.log("Test credentials (all passwords: 'password'):");
  console.log("  superuser             → superuser@localseat.io");
  console.log("  candidate             → alex.chen@example.com");
  console.log("  campaign_manager      → maria.santos@example.com");
  console.log("  field_organizer       → james.okafor@example.com");
  console.log("  field_organizer       → sarah.kim@example.com");
  console.log("  co_chair              → claire.morgan@example.com");
  console.log("  co_chair              → robert.bell@example.com");
  console.log("  finance_lead          → dan.wu@example.com");
  console.log("  volunteer_coordinator → sara.bishop@example.com");
  console.log("  canvasser             → priya.nair@example.com");
  console.log("  canvasser             → kevin.lafleur@example.com");
  console.log("  canvasser             → amy.zhang@example.com");
  console.log("  canvasser             → tom.okonkwo@example.com");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
