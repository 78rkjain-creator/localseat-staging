/**
 * Seed script for LocalSeat — foundation + address structure.
 *
 * Creates:
 *   - 1 campaign (Owen Sound Ward 4 — 2026)
 *   - 13 users across all roles (password: "password")
 *   - 6 system/user-facing tags
 *   - 555 addresses across 16 real Owen Sound streets (pre-geocoded)
 *   - 555 households (100×1 + 200×2 + 100×3 + 75×4 + 80×5)
 *   - 1500 placeholder voter records
 *
 * Run: npm run db:seed
 */

import { PrismaClient, SupportLevel, CanvassOutcome, DonorStatus, OutreachChannel } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const VERIFIED = new Date();

// ── Cultural name pools ───────────────────────────────────────────────────────
const GROUPS = [
  {
    first: ["James","William","Thomas","Robert","David","Michael","John","Richard","Charles","George","Mary","Patricia","Linda","Barbara","Elizabeth","Jennifer","Susan","Margaret","Dorothy","Helen","Daniel","Matthew","Andrew","Joshua","Ryan","Emma","Olivia","Sophia","Charlotte","Grace"],
    last:  ["Smith","Johnson","Brown","Wilson","Taylor","Anderson","Thomas","Martin","White","Harris"],
  },
  {
    first: ["Jean","Pierre","Michel","François","Philippe","André","Louis","Jacques","Henri","Luc","Marie","Isabelle","Sophie","Camille","Amélie","Claire","Nathalie","Céline","Monique","Brigitte"],
    last:  ["Tremblay","Gagnon","Roy","Côté","Bouchard","Lavoie","Fortin","Gauthier","Morin","Pelletier"],
  },
  {
    first: ["Rahul","Arjun","Vikram","Suresh","Rajesh","Amit","Priya","Anjali","Deepa","Sunita","Neha","Pooja","Kavya","Ravi","Anil","Sanjay","Meera","Divya","Kiran","Manish"],
    last:  ["Patel","Singh","Kumar","Sharma","Jain","Shah","Mehta","Gupta","Verma","Agarwal"],
  },
  {
    first: ["Wei","Ming","Jun","Fang","Yan","Hui","Lin","Ying","Hong","Xiao","Jing","Tao","Yong","Feng","Lei","Na","Hua","Bo","Chen","Li"],
    last:  ["Chen","Wang","Li","Zhang","Liu","Huang","Wu","Yang","Zhou","Xu"],
  },
  {
    first: ["Kwame","Kofi","Emeka","Chidi","Tunde","Yaw","Ade","Bayo","Seun","Dele","Amara","Nkechi","Fatima","Zainab","Aisha","Yewande","Folake","Ngozi","Chiamaka","Abena"],
    last:  ["Okafor","Mensah","Diallo","Nkosi","Owusu","Adeyemi","Ibrahim","Kamara","Diop","Asante"],
  },
];

function culturalGroup(hhIdx: number) {
  const pos = hhIdx % 100;
  if (pos < 30) return GROUPS[0];
  if (pos < 50) return GROUPS[1];
  if (pos < 70) return GROUPS[2];
  if (pos < 85) return GROUPS[3];
  return GROUPS[4];
}

function supportLevel(personIdx: number): string | null {
  if (personIdx <  225) return "strong_yes";
  if (personIdx <  405) return "soft_yes";
  if (personIdx <  630) return "undecided";
  if (personIdx <  765) return "soft_no";
  if (personIdx <  855) return "strong_no";
  if (personIdx <  900) return "not_home";
  return null;
}

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

  const HASH = await bcrypt.hash("password", 12);

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
    db.campaignOverride.deleteMany(),
    db.campaign.deleteMany(),
    db.user.deleteMany(),
    db.platformSettings.deleteMany(),
  ]);
  console.log("  ✓ Cleaned up existing data");

  // ── Campaign ──────────────────────────────────────────────────────────────
  const campaign = await db.campaign.create({
    data: {
      name:         "Owen Sound Ward 4 — 2026",
      ballotName:   "Alex Chen",
      officeSought: "Ward 4 Councillor",
      description:  "Municipal election campaign for Ward 4, Owen Sound, Ontario. Focus on affordable housing, active transportation, and neighbourhood safety.",
      municipality: "Owen Sound",
      wards:        ["Ward 4"],
      city:         "Owen Sound",
      province:     "ON",
      year:         2026,
      electionDate: new Date("2026-10-26T00:00:00.000Z"),
      isActive:      true,
      plan:          process.env.DEMO_MODE === "true" ? "demo" : "election",
      planActivated: true,
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

  await db.user.upsert({
    where:  { email: "superuser@localseat.io" },
    create: { email: "superuser@localseat.io", passwordHash: HASH, firstName: "Super", lastName: "User", isActive: true, platformRole: "super_user", emailVerified: VERIFIED },
    update: { passwordHash: HASH, platformRole: "super_user", emailVerified: VERIFIED },
  });

  const demoUser = await db.user.upsert({
    where:  { email: "demo@localseat.io" },
    create: { email: "demo@localseat.io", passwordHash: HASH, firstName: "Demo", lastName: "Login", isActive: true, emailVerified: VERIFIED },
    update: { passwordHash: HASH, emailVerified: VERIFIED },
  });
  console.log("  ✓ Users: 14 (including platform superuser and demo account)");

  // ── Campaign memberships ──────────────────────────────────────────────────
  await db.campaignMembership.createMany({
    data: [
      { userId: alexChen.id,     campaignId: campaign.id, role: "candidate"             },
      { userId: mariaSantos.id,  campaignId: campaign.id, role: "campaign_manager"      },
      { userId: jamesOkafor.id,  campaignId: campaign.id, role: "field_organizer"       },
      { userId: sarahKim.id,     campaignId: campaign.id, role: "field_organizer"       },
      { userId: claireMorgan.id, campaignId: campaign.id, role: "co_chair"              },
      { userId: robertBell.id,   campaignId: campaign.id, role: "co_chair"              },
      { userId: danWu.id,        campaignId: campaign.id, role: "finance_lead"          },
      { userId: saraBishop.id,   campaignId: campaign.id, role: "volunteer_coordinator" },
      { userId: priyaNair.id,    campaignId: campaign.id, role: "canvasser"             },
      { userId: kevinLafleur.id, campaignId: campaign.id, role: "canvasser"             },
      { userId: amyZhang.id,     campaignId: campaign.id, role: "canvasser"             },
      { userId: tomOkonkwo.id,   campaignId: campaign.id, role: "canvasser"             },
      { userId: demoUser.id,     campaignId: campaign.id, role: "candidate"             },
    ],
  });
  console.log("  ✓ Campaign memberships: 13");

  // ── Tags ──────────────────────────────────────────────────────────────────
  await db.tag.createMany({
    data: [
      { name: "field-entry",        color: "#475569" },
      { name: "record-outdated",    color: "#dc2626" },
      { name: "strong-supporter",   color: "#16a34a" },
      { name: "needs-sign",         color: "#2563eb" },
      { name: "volunteer-interest", color: "#7c3aed" },
      { name: "donor-prospect",     color: "#ea6c0a" },
    ],
  });
  console.log("  ✓ Tags: 6");

  // ── Streets, addresses, households, placeholder voters ───────────────────
  //
  // 16 real Owen Sound streets across 4 neighbourhoods.
  // 11 streets × 35 + 5 streets × 34 = 555 addresses.
  // House numbers: even side only (2, 4, 6, …).
  // All addresses are pre-geocoded with real approximate coordinates.
  //
  // Household size pattern — boundary table:
  // 100 single + 200 two + 100 three + 75 four + 80 five = 555 HH, 1500 voters exactly.

  interface StreetDef {
    name:       string;
    postalCode: string;
    poll:       string;
    baseLat:    number;
    baseLng:    number;
    latStep:    number;
    lngStep:    number;
  }

  const STREETS: StreetDef[] = [
    // ── Neighbourhood 1: Downtown East — avenues run N-S, lat increments per house ──
    { name: "2nd Ave E", postalCode: "N4K 2H1", poll: "Poll 1", baseLat: 44.5580, baseLng: -80.9401, latStep: 0.00012, lngStep: 0 },
    { name: "3rd Ave E", postalCode: "N4K 2H1", poll: "Poll 1", baseLat: 44.5580, baseLng: -80.9375, latStep: 0.00012, lngStep: 0 },
    { name: "4th Ave E", postalCode: "N4K 2H1", poll: "Poll 2", baseLat: 44.5580, baseLng: -80.9348, latStep: 0.00012, lngStep: 0 },
    { name: "5th Ave E", postalCode: "N4K 2H1", poll: "Poll 2", baseLat: 44.5580, baseLng: -80.9322, latStep: 0.00012, lngStep: 0 },
    // ── Neighbourhood 2: East Side Residential — avenues run N-S ───────────
    { name: "6th Ave E", postalCode: "N4K 3C4", poll: "Poll 3", baseLat: 44.5580, baseLng: -80.9295, latStep: 0.00012, lngStep: 0 },
    { name: "7th Ave E", postalCode: "N4K 3C4", poll: "Poll 3", baseLat: 44.5580, baseLng: -80.9268, latStep: 0.00012, lngStep: 0 },
    { name: "8th Ave E", postalCode: "N4K 3C4", poll: "Poll 4", baseLat: 44.5580, baseLng: -80.9242, latStep: 0.00012, lngStep: 0 },
    { name: "9th Ave E", postalCode: "N4K 3C4", poll: "Poll 4", baseLat: 44.5580, baseLng: -80.9215, latStep: 0.00012, lngStep: 0 },
    // ── Neighbourhood 3: West Side — avenues run N-S ────────────────────────
    { name: "2nd Ave W", postalCode: "N4K 1T6", poll: "Poll 5", baseLat: 44.5580, baseLng: -80.9468, latStep: 0.00012, lngStep: 0 },
    { name: "3rd Ave W", postalCode: "N4K 1T6", poll: "Poll 5", baseLat: 44.5580, baseLng: -80.9495, latStep: 0.00012, lngStep: 0 },
    { name: "4th Ave W", postalCode: "N4K 1T6", poll: "Poll 6", baseLat: 44.5580, baseLng: -80.9522, latStep: 0.00012, lngStep: 0 },
    { name: "5th Ave W", postalCode: "N4K 1T6", poll: "Poll 6", baseLat: 44.5580, baseLng: -80.9548, latStep: 0.00012, lngStep: 0 },
    // ── Neighbourhood 4: North End — streets run E-W, lng increments per house ──
    { name: "10th St E", postalCode: "N4K 4L8", poll: "Poll 7", baseLat: 44.5756, baseLng: -80.9548, latStep: 0, lngStep: 0.00018 },
    { name: "11th St E", postalCode: "N4K 4L8", poll: "Poll 7", baseLat: 44.5770, baseLng: -80.9548, latStep: 0, lngStep: 0.00018 },
    { name: "12th St E", postalCode: "N4K 4L8", poll: "Poll 8", baseLat: 44.5784, baseLng: -80.9548, latStep: 0, lngStep: 0.00018 },
    { name: "13th St E", postalCode: "N4K 4L8", poll: "Poll 8", baseLat: 44.5798, baseLng: -80.9548, latStep: 0, lngStep: 0.00018 },
  ];

  function hhSize(idx: number): number {
    if (idx <  100) return 1;
    if (idx <  300) return 2;
    if (idx <  400) return 3;
    if (idx <  475) return 4;
    return               5;
  }

  const HOUSES_PER_STREET = [35,35,35,35,35,35,35,35,35,35,35,34,34,34,34,34];

  const addressRows = STREETS.flatMap((street, si) =>
    Array.from({ length: HOUSES_PER_STREET[si] }, (_, i) => ({
      campaignId:   campaign.id,
      streetNumber: String((i + 1) * 2),
      streetName:   street.name,
      city:         "Owen Sound",
      province:     "ON",
      postalCode:   street.postalCode,
      lat:          street.baseLat + i * street.latStep,
      lng:          street.baseLng + i * street.lngStep,
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
    const streetIdx = HOUSES_PER_STREET.reduce((found, count, si) => {
      return hhIdx >= streetStartIdx[si] && hhIdx < streetStartIdx[si] + count ? si : found;
    }, 0);
    const poll  = STREETS[streetIdx].poll;
    const size  = hhSize(hhIdx);
    const group = culturalGroup(hhIdx);
    const lastName = group.last[hhIdx % group.last.length];

    for (let p = 0; p < size; p++) {
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
      name:           "Downtown East Route",
      description:    "Initial door knock on 2nd Ave E",
      street:         "2nd Ave E",
      canvasser:      priyaNair,
      totalEntries:   40,
      completedCount: 24,
    },
    {
      name:           "East Side Route",
      description:    "6th Ave E east side canvass",
      street:         "6th Ave E",
      canvasser:      kevinLafleur,
      totalEntries:   35,
      completedCount: 14,
    },
    {
      name:           "West Side Route",
      description:    "Full 2nd Ave W sweep",
      street:         "2nd Ave W",
      canvasser:      amyZhang,
      totalEntries:   45,
      completedCount:  9,
    },
    {
      name:           "North End Route",
      description:    "10th St E first pass",
      street:         "10th St E",
      canvasser:      tomOkonkwo,
      totalEntries:   30,
      completedCount:  0,
    },
  ];

  let totalResponses = 0;

  for (let listIdx = 0; listIdx < WALK_LIST_DEFS.length; listIdx++) {
    const def = WALK_LIST_DEFS[listIdx];
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
  const donorPersons = await db.person.findMany({
    where: { campaignId: campaign.id },
    take: 20,
    skip: 50,
  });

  const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

  const DONOR_NOTES: (string | null)[] = [
    null, null, null, null, null, null, null, null,
    "Pledged at door", "Pledged at door", "Pledged at door", "Pledged at door", "Pledged at door",
    "E-transfer received", "E-transfer received", "Cheque by mail", "Cheque by mail",
    "E-transfer received", "Cheque by mail", "E-transfer received",
  ];

  await db.donor.createMany({
    data: donorPersons.map((p, i) => {
      const isReceived = i >= 13;
      const isThanked  = i >= 17;
      const status     = i < 8  ? DonorStatus.interested
                       : i < 13 ? DonorStatus.pledged
                       :           DonorStatus.received;
      const createdAt  = new Date(nowMs - Math.random() * FOUR_WEEKS_MS);
      const amount     = 50 + Math.floor(Math.random() * 701);
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
  const SHIFT_DEFS = [
    { name: "Saturday Canvass — Downtown East", date: new Date("2026-04-18T00:00:00Z"), startTime: "09:00", endTime: "13:00", maxVolunteers:  8 },
    { name: "Phone Banking Evening",            date: new Date("2026-04-21T00:00:00Z"), startTime: "18:00", endTime: "21:00", maxVolunteers:  6 },
    { name: "Sign Installation",                date: new Date("2026-04-25T00:00:00Z"), startTime: "10:00", endTime: "14:00", maxVolunteers: 10 },
    { name: "Voter Contact Blitz",              date: new Date("2026-05-02T00:00:00Z"), startTime: "09:00", endTime: "12:00", maxVolunteers:  8 },
    { name: "Final Push Canvass",               date: new Date("2026-10-24T00:00:00Z"), startTime: "08:00", endTime: "17:00", maxVolunteers: 15 },
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

  // ── Outreach log ──────────────────────────────────────────────────────────
  const SIX_WEEKS_MS = 42 * 24 * 60 * 60 * 1000;

  function randomOutreachDate(): Date {
    return new Date(nowMs - Math.random() * SIX_WEEKS_MS);
  }

  function outreachOutcome(sl: string | null): string {
    if (sl === "strong_yes" || sl === "soft_yes") return "positive";
    if (sl === "undecided") return "neutral";
    if (sl === "soft_no" || sl === "strong_no") return "negative";
    if (sl === "not_home") return "not_home";
    return "contacted";
  }

  const canvassResponses = await db.canvassResponse.findMany({
    include: { assignment: true },
  });

  await db.outreachLog.createMany({
    data: canvassResponses.map((r) => ({
      campaignId: campaign.id,
      personId:   r.personId,
      userId:     r.assignment.canvasserId,
      channel:    OutreachChannel.door_knock,
      date:       r.respondedAt,
      outcome:    outreachOutcome(r.supportLevel),
      ...(r.notes ? { notes: r.notes } : {}),
    })),
  });

  const manualPersons = await db.person.findMany({
    where: { campaignId: campaign.id },
    take: 100,
    skip: 200,
  });

  const fieldUsers = [jamesOkafor, sarahKim, mariaSantos, priyaNair, kevinLafleur, amyZhang, tomOkonkwo];

  const PHONE_NOTES = [
    "Reached, very supportive",
    "Left voicemail",
    "Discussed housing concerns",
    "Spoke about transit plans",
    "Requested callback",
  ];
  const DOOR_NOTES = [
    "Resident not home",
    "Spoke at door briefly",
    "Left flyer",
    "Positive conversation",
    "Spoke with tenant, not owner",
  ];
  const EMAIL_NOTES = [
    "Replied with support",
    "No response yet",
    "Asked about platform positions",
    "Forwarded to neighbours",
    "Requested more information",
  ];
  const EVENT_NOTES = [
    "Met at community meeting",
    "Spoke at school council event",
    "Connected at local library",
    "Met at farmers market",
    "Approached at neighbourhood cafe",
  ];

  const PHONE_OUTCOMES = ["positive", "voicemail", "no_answer", "neutral", "not_home"];
  const DOOR_OUTCOMES  = ["positive", "not_home", "neutral", "negative", "positive"];
  const EMAIL_OUTCOMES = ["positive", "neutral", "no_response", "positive", "neutral"];

  const manualRows: {
    campaignId: string;
    personId:   string;
    userId:     string;
    channel:    OutreachChannel;
    date:       Date;
    outcome:    string;
    notes:      string;
  }[] = [];

  for (let i = 0; i < 40 && i < manualPersons.length; i++) {
    manualRows.push({
      campaignId: campaign.id,
      personId:   manualPersons[i].id,
      userId:     fieldUsers[i % fieldUsers.length].id,
      channel:    OutreachChannel.phone_call,
      date:       randomOutreachDate(),
      outcome:    PHONE_OUTCOMES[i % PHONE_OUTCOMES.length],
      notes:      PHONE_NOTES[i % PHONE_NOTES.length],
    });
  }

  for (let i = 40; i < 70 && i < manualPersons.length; i++) {
    manualRows.push({
      campaignId: campaign.id,
      personId:   manualPersons[i].id,
      userId:     fieldUsers[i % fieldUsers.length].id,
      channel:    OutreachChannel.door_knock,
      date:       randomOutreachDate(),
      outcome:    DOOR_OUTCOMES[i % DOOR_OUTCOMES.length],
      notes:      DOOR_NOTES[i % DOOR_NOTES.length],
    });
  }

  for (let i = 70; i < 90 && i < manualPersons.length; i++) {
    manualRows.push({
      campaignId: campaign.id,
      personId:   manualPersons[i].id,
      userId:     [mariaSantos, jamesOkafor, sarahKim][i % 3].id,
      channel:    OutreachChannel.email,
      date:       randomOutreachDate(),
      outcome:    EMAIL_OUTCOMES[i % EMAIL_OUTCOMES.length],
      notes:      EMAIL_NOTES[i % EMAIL_NOTES.length],
    });
  }

  for (let i = 90; i < 100 && i < manualPersons.length; i++) {
    manualRows.push({
      campaignId: campaign.id,
      personId:   manualPersons[i].id,
      userId:     [alexChen, mariaSantos, jamesOkafor][i % 3].id,
      channel:    OutreachChannel.in_person,
      date:       randomOutreachDate(),
      outcome:    "positive",
      notes:      EVENT_NOTES[i % EVENT_NOTES.length],
    });
  }

  await db.outreachLog.createMany({ data: manualRows });
  console.log(
    `  ✓ Outreach log: ${canvassResponses.length + manualRows.length} entries ` +
    `(${canvassResponses.length} from canvass, ${manualRows.length} manual)`
  );

  // ── Audit log ─────────────────────────────────────────────────────────────
  function randomAuditDate(): Date {
    return new Date(nowMs - Math.random() * SIX_WEEKS_MS);
  }

  const auditRows: {
    campaignId?: string;
    userId?:     string;
    action:      string;
    entityType:  string;
    entityId:    string;
    before?:     object;
    after?:      object;
    createdAt:   Date;
  }[] = [];

  const allFieldUsers  = [jamesOkafor, sarahKim, priyaNair, kevinLafleur];
  const canvassersOnly = [priyaNair, kevinLafleur, amyZhang, tomOkonkwo];
  const loginUsers     = [alexChen, mariaSantos, jamesOkafor, sarahKim, priyaNair, kevinLafleur, amyZhang, tomOkonkwo];

  for (let i = 0; i < 15; i++) {
    const u = loginUsers[i % loginUsers.length];
    auditRows.push({ campaignId: campaign.id, userId: u.id, action: "LOGIN",                         entityType: "user",                   entityId: u.id,        createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 10; i++) {
    const u = canvassersOnly[i % canvassersOnly.length];
    auditRows.push({ campaignId: campaign.id, userId: u.id, action: "CANVASS_RESPONSE_SAVED",        entityType: "canvass_response",       entityId: campaign.id, createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 8; i++) {
    const u = allFieldUsers[i % allFieldUsers.length];
    auditRows.push({ campaignId: campaign.id, userId: u.id, action: "FOLLOW_UP_CREATED",             entityType: "task",                   entityId: campaign.id, createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 8; i++) {
    const u = allFieldUsers[i % allFieldUsers.length];
    auditRows.push({ campaignId: campaign.id, userId: u.id, action: "FOLLOW_UP_COMPLETED",           entityType: "task",                   entityId: campaign.id, createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 8; i++) {
    const u = [jamesOkafor, sarahKim, mariaSantos, priyaNair][i % 4];
    auditRows.push({ campaignId: campaign.id, userId: u.id, action: "NOTE_ADDED",                    entityType: "note",                   entityId: campaign.id, createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 8; i++) {
    auditRows.push({ campaignId: campaign.id, userId: mariaSantos.id, action: "VOTER_LIST_IMPORTED",  entityType: "voter_list",             entityId: campaign.id, createdAt: randomAuditDate(), after: { count: 50 + i * 20 } });
  }
  for (let i = 0; i < 6; i++) {
    auditRows.push({ campaignId: campaign.id, userId: mariaSantos.id, action: "MEMBER_ADDED",         entityType: "campaign_membership",    entityId: campaign.id, createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 5; i++) {
    auditRows.push({ campaignId: campaign.id, userId: mariaSantos.id, action: "ROLE_CHANGED",         entityType: "campaign_membership",    entityId: campaign.id, createdAt: randomAuditDate(), before: { role: "canvasser" }, after: { role: "field_organizer" } });
  }
  for (let i = 0; i < 5; i++) {
    const u = [mariaSantos, jamesOkafor, sarahKim][i % 3];
    auditRows.push({ campaignId: campaign.id, userId: u.id,           action: "EXPORT_VOTER_LIST",    entityType: "voter_list",             entityId: campaign.id, createdAt: randomAuditDate(), after: { format: "csv", rows: 100 + i * 50 } });
  }
  for (let i = 0; i < 4; i++) {
    auditRows.push({ campaignId: campaign.id, userId: jamesOkafor.id, action: "ADDRESS_CHANGE_APPROVED", entityType: "address_change_request", entityId: campaign.id, createdAt: randomAuditDate() });
  }
  for (let i = 0; i < 3; i++) {
    const u = [priyaNair, kevinLafleur, amyZhang][i];
    auditRows.push({ userId: u.id, action: "PASSWORD_RESET_REQUESTED", entityType: "user", entityId: u.id, createdAt: randomAuditDate() });
  }

  await db.auditLog.createMany({ data: auditRows });
  console.log(`  ✓ Audit log: ${auditRows.length} entries`);

  // ── Address change requests ───────────────────────────────────────────────
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const [acrSource1, acrSource2, acrSource3] = await Promise.all([
    db.person.findMany({
      where: { campaignId: campaign.id, household: { address: { streetName: "2nd Ave E" } } },
      take: 1,
      include: { household: true },
    }),
    db.person.findMany({
      where: { campaignId: campaign.id, household: { address: { streetName: "3rd Ave E" } } },
      take: 2,
      include: { household: true },
    }),
    db.person.findMany({
      where: { campaignId: campaign.id, household: { address: { streetName: "2nd Ave W" } } },
      take: 1,
      include: { household: true },
    }),
  ]);

  await db.addressChangeRequest.createMany({
    data: [
      {
        campaignId:        campaign.id,
        requestedByUserId: priyaNair.id,
        personId:          acrSource1[0].id,
        affectedPersonIds: [acrSource1[0].id],
        oldAddressId:      acrSource1[0].household?.addressId ?? undefined,
        newAddressData:    { streetNumber: "45", streetName: "4th Ave E", city: "Owen Sound", province: "ON", postalCode: "N4K 2H1" },
        createdAt:         new Date(nowMs - Math.random() * ONE_WEEK_MS),
      },
      {
        campaignId:        campaign.id,
        requestedByUserId: kevinLafleur.id,
        personId:          acrSource2[0].id,
        affectedPersonIds: [acrSource2[0].id, acrSource2[1].id],
        oldAddressId:      acrSource2[0].household?.addressId ?? undefined,
        newAddressData:    { streetNumber: "88", streetName: "6th Ave E", city: "Owen Sound", province: "ON", postalCode: "N4K 3C4" },
        createdAt:         new Date(nowMs - Math.random() * ONE_WEEK_MS),
      },
      {
        campaignId:        campaign.id,
        requestedByUserId: amyZhang.id,
        personId:          acrSource3[0].id,
        affectedPersonIds: [acrSource3[0].id],
        oldAddressId:      acrSource3[0].household?.addressId ?? undefined,
        newAddressData:    { streetNumber: "12", streetName: "10th St E", city: "Owen Sound", province: "ON", postalCode: "N4K 4L8" },
        createdAt:         new Date(nowMs - Math.random() * ONE_WEEK_MS),
      },
    ],
  });
  console.log("  ✓ Address change requests: 3 pending");

  console.log("\n✅ Foundation seed complete.\n");
  console.log("Test credentials (all passwords: 'password'):");
  console.log("  demo_entry            → demo@localseat.io");
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

  // ── Platform Settings ─────────────────────────────────────────────────────
  const SETTINGS: { key: string; value: string }[] = [
    { key: "starter_price",                   value: "149"      },
    { key: "campaign_price",                  value: "349"      },
    { key: "election_price",                  value: "699"      },
    { key: "starter_label",                   value: "Starter"  },
    { key: "campaign_label",                  value: "Campaign" },
    { key: "election_label",                  value: "Election" },
    { key: "starter_constituent_limit",       value: "2500"     },
    { key: "campaign_constituent_limit",      value: "15000"    },
    { key: "election_constituent_limit",      value: "0"        },
    { key: "starter_canvasser_limit",         value: "3"        },
    { key: "campaign_canvasser_limit",        value: "0"        },
    { key: "election_canvasser_limit",        value: "0"        },
    { key: "starter_campaign_manager_limit",  value: "1"        },
    { key: "campaign_campaign_manager_limit", value: "0"        },
    { key: "election_campaign_manager_limit", value: "0"        },
    { key: "starter_cochair_limit",           value: "0"        },
    { key: "campaign_cochair_limit",          value: "2"        },
    { key: "election_cochair_limit",          value: "0"        },
    { key: "starter_field_organizer_limit",   value: "1"        },
    { key: "campaign_field_organizer_limit",  value: "0"        },
    { key: "election_field_organizer_limit",  value: "0"        },
  ];

  for (let i = 0; i < SETTINGS.length; i++) {
    const s = SETTINGS[i];
    await db.platformSettings.upsert({
      where:  { key: s.key },
      create: { key: s.key, value: s.value },
      update: { value: s.value },
    });
  }
  console.log(`  ✓ Platform settings: ${SETTINGS.length} entries`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
