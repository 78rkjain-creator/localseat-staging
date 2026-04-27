/**
 * Seed script for LocalSeat — foundation + address structure.
 *
 * Creates:
 *   - 1 campaign (Owen Sound Ward 4 — 2026)
 *   - 13 users across all roles (password: "password")
 *   - 6 system/user-facing tags
 *   - 555 addresses across 16 real Owen Sound streets (coordinates computed from STREETS defs)
 *   - 555 households (100×1 + 200×2 + 100×3 + 75×4 + 80×5)
 *   - 1500 placeholder voter records
 *
 * Run: npm run db:seed
 */

import { PrismaClient, SupportLevel, CanvassOutcome, DonorStatus, OutreachChannel, SignStatus, SignLocationType, ListSource } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const VERIFIED = new Date();

// ── Pre-built person name pool ─────────────────────────────────────────────
// 1,500 {firstName, lastName} pairs — first and last always share the same
// cultural origin so combinations read naturally.
//
// Groups and targets:
//   English/Irish/Scottish  375  (25%)   50 first × 25 last = 1 250 combos
//   French-Canadian         225  (15%)   30 first × 15 last =   450 combos
//   South Asian             225  (15%)   30 first × 15 last =   450 combos
//   East Asian              225  (15%)   30 first × 15 last =   450 combos
//   African/Caribbean       150  (10%)   25 first × 15 last =   375 combos
//   Eastern European        150  (10%)   25 first × 15 last =   375 combos
//   Middle Eastern          150  (10%)   25 first × 15 last =   375 combos
//
// Within each group all combinations are generated, shuffled with a seeded
// LCG, and then truncated to the target count.  A second global shuffle
// distributes groups so no cultural cluster runs in sequence.
const PEOPLE: { firstName: string; lastName: string }[] = (() => {
  const groups: { first: string[]; last: string[]; count: number }[] = [
    {
      count: 375,
      first: [
        "James","William","Thomas","Robert","David","Liam","Connor","Patrick","Sean","Scott",
        "Ian","Fraser","Callum","Neil","Graham","Stuart","Kevin","Brian","Andrew","Matthew",
        "Brendan","Craig","Christopher","Paul","Angus",
        "Mary","Elizabeth","Sarah","Catherine","Emma","Fiona","Siobhan","Grace","Margaret","Laura",
        "Emily","Claire","Karen","Wendy","Janet","Sheila","Hannah","Rachel","Jessica","Lucy",
        "Aoife","Niamh","Catriona","Bridget","Sharon",
      ],
      last: [
        "Smith","Thompson","Brown","Wilson","MacLeod","O'Brien","Campbell","Taylor","Anderson","Harris",
        "Clarke","Murphy","Stewart","Walsh","Robertson","Henderson","Ross","Fleming","Murray","Sinclair",
        "MacDonald","Boyd","Grant","Reid","Hamilton",
      ],
    },
    {
      count: 225,
      first: [
        "Jean","Pierre","Michel","François","Philippe","André","Marc","Luc","Bruno","Rémi",
        "Alain","Denis","Yves","Gilles","Serge","Sylvain","Pascal","Laurent","Olivier","Mathieu",
        "Marie","Isabelle","Sophie","Céline","Nathalie","Camille","Amélie","Chantal","Véronique","Josée",
      ],
      last: [
        "Tremblay","Gagnon","Roy","Côté","Bouchard","Lavoie","Fortin","Gauthier","Morin","Pelletier",
        "Leblanc","Bélanger","Bergeron","Girard","Ouellet",
      ],
    },
    {
      count: 225,
      first: [
        "Rahul","Arjun","Amit","Vikram","Sanjay","Ravi","Manish","Rohit","Deepak","Nikhil",
        "Anil","Pradeep","Sachin","Gaurav","Tarun",
        "Priya","Anjali","Neha","Deepa","Sunita","Kavya","Divya","Meera","Anita","Shalini",
        "Rekha","Geeta","Usha","Leela","Radha",
      ],
      last: [
        "Patel","Singh","Sharma","Nair","Kumar","Mehta","Gupta","Shah","Verma","Jain",
        "Agarwal","Chopra","Malhotra","Rao","Iyer",
      ],
    },
    {
      count: 225,
      first: [
        "Wei","Lin","Ming","Yan","Hong","Fang","Tao","Hua","Bo","Jing",
        "Junho","Minseo","Jisoo","Soyeon","Seojun",
        "Yuki","Hana","Kenji","Akira","Haruki",
        "Linh","Minh","Tuan","Thuy","Huong","Duc","Anh","Lan","Hoa","Mai",
      ],
      last: [
        "Chen","Kim","Nguyen","Wong","Park","Zhang","Li","Wu","Tanaka","Yamamoto",
        "Pham","Tran","Choi","Lim","Huang",
      ],
    },
    {
      count: 150,
      first: [
        "Kwame","Kofi","Emeka","Yaw","Obinna","Chidi","Tunde","Kojo","Nana","Kweku",
        "Babatunde","Olumide","Adewale","Seun","Dele",
        "Amara","Fatima","Aisha","Ngozi","Abena","Nkechi","Chiamaka","Yewande","Adaeze","Efua",
      ],
      last: [
        "Okafor","Mensah","Diallo","Nkosi","Asante","Adeyemi","Kamara","Diop","Owusu","Ibrahim",
        "Eze","Idowu","Osei","Abiodun","Olawale",
      ],
    },
    {
      count: 150,
      first: [
        "Aleksei","Marek","Ivan","Dmitri","Pavel","Viktor","Mikhail","Piotr","Tomasz","Lukasz",
        "Miroslav","Stefan","Bogdan","Vladimir","Radoslav",
        "Natasha","Elena","Katarzyna","Agnieszka","Magdalena","Monika","Joanna","Izabela","Oksana","Tatyana",
      ],
      last: [
        "Kowalski","Petrov","Novak","Kovac","Popescu","Nowak","Wisniewski","Kaminski","Lewandowski","Malinowski",
        "Kubiak","Zielinski","Szymanski","Wojciechowski","Wolski",
      ],
    },
    {
      count: 150,
      first: [
        "Omar","Hassan","Tariq","Ahmed","Khalid","Youssef","Mustafa","Karim","Bilal","Amir",
        "Walid","Jamal","Samir","Rami","Adnan",
        "Layla","Yasmin","Nour","Rania","Amira","Samira","Hiba","Dina","Leila","Maryam",
      ],
      last: [
        "Mansour","Aziz","Rahman","Nasser","Khoury","Saleh","Haddad","Chaaban","Nassar","Farouk",
        "Rashid","Amin","Zaki","Qasim","Bishara",
      ],
    },
  ];

  // Seeded LCG — deterministic so the list is stable across reseeds
  let s = 2718281828;
  const rand = (n: number) => { s = (s * 1664525 + 1013904223) >>> 0; return s % n; };

  const entries: { firstName: string; lastName: string }[] = [];

  for (const { first, last, count } of groups) {
    // Generate all combinations for this group
    const combos: { firstName: string; lastName: string }[] = [];
    for (const fn of first) {
      for (const ln of last) {
        combos.push({ firstName: fn, lastName: ln });
      }
    }
    // Shuffle within group so every first name appears proportionally
    for (let i = combos.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [combos[i], combos[j]] = [combos[j], combos[i]];
    }
    entries.push(...combos.slice(0, count));
  }

  // Global shuffle — eliminates cultural clustering across the full list
  for (let i = entries.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  return entries;
})();

function supportLevel(personIdx: number): SupportLevel | null {
  if (personIdx <  225) return "strong_yes";
  if (personIdx <  405) return "soft_yes";
  if (personIdx <  630) return "undecided";
  if (personIdx <  765) return "soft_no";
  if (personIdx <  855) return "strong_no";
  if (personIdx <  900) return "not_home";
  return null;
}

function phoneHome(personIdx: number): string | null {
  if (personIdx >= 750) return null;
  const xxxx = String(1000 + ((personIdx * 7919 + 3141) % 9000));
  return `(519) 555-${xxxx}`;
}

function phoneMobile(personIdx: number): string | null {
  if (personIdx >= 188) return null;
  const xxxx = String(1000 + ((personIdx * 6271 + 2718) % 9000));
  return `(416) 555-${xxxx}`;
}

async function main() {
  if (process.env.DATABASE_URL?.includes("localseat_prod")) {
    console.error("❌ Seed aborted: DATABASE_URL points to localseat_prod. Refusing to seed a production database.");
    process.exit(1);
  }

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
    (db as any).votingRecord.deleteMany(),
    db.voterChangeRequest.deleteMany(),
    db.personListMembership.deleteMany(),
    db.listImport.deleteMany(),
    db.sign.deleteMany(),
    db.eventAttendee.deleteMany(),
    db.event.deleteMany(),
    db.fieldMessage.deleteMany(),
    db.person.deleteMany(),
    db.household.deleteMany(),
    db.address.deleteMany(),
    db.campaignMembership.deleteMany(),
    db.campaignOverride.deleteMany(),
    (db as any).campaignCompetitor.deleteMany(),
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
      customFields: [
        { id: "cf_2022_mun",  label: "2022 Municipal Election" },
        { id: "cf_2025_prov", label: "2025 Provincial Election" },
      ],
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
    mikeDavidson,
  ] = await Promise.all([
    db.user.create({ data: { email: "alex.chen@example.com",      passwordHash: HASH, firstName: "Alex",   lastName: "Chen",     phoneHome: "613-555-0100", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "maria.santos@example.com",   passwordHash: HASH, firstName: "Maria",  lastName: "Santos",   phoneHome: "613-555-0101", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "james.okafor@example.com",   passwordHash: HASH, firstName: "James",  lastName: "Okafor",   phoneHome: "613-555-0102", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "sarah.kim@example.com",      passwordHash: HASH, firstName: "Sarah",  lastName: "Kim",      phoneHome: "613-555-0103", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "claire.morgan@example.com",  passwordHash: HASH, firstName: "Claire", lastName: "Morgan",   phoneHome: "613-555-0104", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "robert.bell@example.com",    passwordHash: HASH, firstName: "Robert", lastName: "Bell",     phoneHome: "613-555-0105", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "dan.wu@example.com",         passwordHash: HASH, firstName: "Dan",    lastName: "Wu",       phoneHome: "613-555-0106", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "sara.bishop@example.com",    passwordHash: HASH, firstName: "Sara",   lastName: "Bishop",   phoneHome: "613-555-0107", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "priya.nair@example.com",     passwordHash: HASH, firstName: "Priya",  lastName: "Nair",     phoneHome: "613-555-0108", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "kevin.lafleur@example.com",  passwordHash: HASH, firstName: "Kevin",  lastName: "Lafleur",  phoneHome: "613-555-0109", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "amy.zhang@example.com",      passwordHash: HASH, firstName: "Amy",    lastName: "Zhang",    phoneHome: "613-555-0110", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "tom.okonkwo@example.com",    passwordHash: HASH, firstName: "Tom",    lastName: "Okonkwo",  phoneHome: "613-555-0111", emailVerified: VERIFIED } }),
    db.user.create({ data: { email: "mike.davidson@example.com",  passwordHash: HASH, firstName: "Mike",   lastName: "Davidson", phoneHome: "613-555-0112", emailVerified: VERIFIED } }),
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
  console.log("  ✓ Users: 15 (including platform superuser, demo account, and sign installer)");

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
      { userId: mikeDavidson.id, campaignId: campaign.id, role: "sign_installer"        },
      { userId: demoUser.id,     campaignId: campaign.id, role: "candidate"             },
    ],
  });
  console.log("  ✓ Campaign memberships: 14");

  // ── Tags ──────────────────────────────────────────────────────────────────
  await db.tag.createMany({
    data: [
      { name: "Volunteer",      color: "#22c55e", campaignId: campaign.id },
      { name: "Donor",          color: "#f97316", campaignId: campaign.id },
      { name: "Endorser",       color: null,      campaignId: campaign.id },
      { name: "Sign location",  color: "#eab308", campaignId: campaign.id },
      { name: "Do not contact", color: "#ef4444", campaignId: campaign.id },
      { name: "Media",          color: null,      campaignId: campaign.id },
      { name: "VIP",            color: "#f97316", campaignId: campaign.id },
      { name: "Influencer",     color: null,      campaignId: campaign.id },
    ],
  });
  console.log("  ✓ Tags: 8");

  // ── Streets, addresses, households, placeholder voters ───────────────────
  //
  // 16 real Owen Sound streets across 4 neighbourhoods.
  // 11 streets × 35 + 5 streets × 34 = 555 addresses.
  // House numbers: even side only (2, 4, 6, …).
  // Coordinates are computed from each street's baseLat/baseLng/latStep/lngStep.
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

  const CF_PROVINCIAL = ["Liberal", "Conservative", "NDP", "Green"] as const;
  let cfGroupIdx = 0;

  const personRows: {
    campaignId:          string;
    householdId:         string;
    firstName:           string;
    lastName:            string;
    pollNumber:          string;
    importSource:        string;
    listSource:          ListSource;
    includeInWalkLists?: boolean;
    supportLevel?:       SupportLevel;
    phoneHome?:          string;
    phoneMobile?:        string;
    customFieldValues?:  Record<string, string>;
  }[] = [];

  households.forEach((hh, hhIdx) => {
    const streetIdx = HOUSES_PER_STREET.reduce((found, count, si) => {
      return hhIdx >= streetStartIdx[si] && hhIdx < streetStartIdx[si] + count ? si : found;
    }, 0);
    const poll  = STREETS[streetIdx].poll;
    const size  = hhSize(hhIdx);
    for (let p = 0; p < size; p++) {
      const pIdx = personRows.length;
      const { firstName, lastName } = PEOPLE[pIdx % PEOPLE.length];
      const sl   = supportLevel(pIdx);
      const ph   = phoneHome(pIdx);
      const pm   = phoneMobile(pIdx);
      const isSelected = pIdx % 3 === 0;
      const cfv: Record<string, string> | undefined = isSelected
        ? {
            // Municipal: only record "Voted" — absence means no data / did not vote
            ...(cfGroupIdx % 2 === 0 ? { cf_2022_mun: "Voted" } : {}),
            cf_2025_prov: CF_PROVINCIAL[cfGroupIdx % 4],
          }
        : undefined;
      if (isSelected) cfGroupIdx++;

      personRows.push({
        campaignId:   campaign.id,
        householdId:  hh.id,
        firstName,
        lastName,
        pollNumber:   poll,
        importSource: "2022 Municipal Voter List",
        listSource:   ListSource.voters_list,
        ...(sl  ? { supportLevel:      sl  } : {}),
        ...(ph  ? { phoneHome:         ph  } : {}),
        ...(pm  ? { phoneMobile:       pm  } : {}),
        ...(cfv ? { customFieldValues: cfv } : {}),
      });
    }
  });

  await db.person.createMany({ data: personRows });
  const cfProvincial = personRows.filter((r) => r.customFieldValues?.cf_2025_prov).length;
  const cfMunicipal  = personRows.filter((r) => r.customFieldValues?.cf_2022_mun).length;
  console.log(`  ✓ Placeholder voters: ${personRows.length} (cf_2025_prov: ${cfProvincial}, cf_2022_mun "Voted": ${cfMunicipal})`);

  // ── Manual seed persons (for testing listSource + includeInWalkLists) ─────
  // Three manually-added supporters. One has includeInWalkLists=true so
  // the walk-list override flow can be tested without modifying real data.
  await db.person.createMany({
    data: [
      {
        campaignId:  campaign.id,
        householdId: households[0].id,
        firstName:   "Jordan",
        lastName:    "Manual",
        listSource:  ListSource.manual,
        sourceNotes: "manually-added",
      },
      {
        campaignId:  campaign.id,
        householdId: households[1].id,
        firstName:   "Casey",
        lastName:    "ManualTwo",
        listSource:  ListSource.manual,
        sourceNotes: "manually-added",
      },
      {
        campaignId:         campaign.id,
        householdId:        households[2].id,
        firstName:          "Riley",
        lastName:           "ManualIncluded",
        listSource:         ListSource.manual,
        includeInWalkLists: true,
        sourceNotes:        "manually-added",
      },
    ],
  });
  console.log("  ✓ Manual persons: 3 (1 with includeInWalkLists=true)");

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

  // ── Competitors ───────────────────────────────────────────────────────────
  const competitors = await Promise.all([
    db.campaignCompetitor.create({ data: { campaignId: campaign.id, name: "Akshay Kumar", sortOrder: 1 } }),
    db.campaignCompetitor.create({ data: { campaignId: campaign.id, name: "Charles Wong", sortOrder: 2 } }),
    db.campaignCompetitor.create({ data: { campaignId: campaign.id, name: "Walter Smith", sortOrder: 3 } }),
  ]);
  console.log("  ✔ Competitors: 3");

  // ── Extended canvass responses (voter ID story) ───────────────────────────
  const dtAssignment = await db.canvassAssignment.findFirst({
    where: { canvassList: { campaignId: campaign.id, name: "Downtown East Route" } },
    include: { canvassList: { select: { id: true, name: true, campaignId: true } } },
  });
  console.log("  dtAssignment:", dtAssignment?.id, "canvassList.campaignId:", (dtAssignment as any)?.canvassList?.campaignId, "campaign.id:", campaign.id);

  const uncontactedPeople = await db.person.findMany({
    where: {
      campaignId: campaign.id,
      canvassResponses: { none: {} },
      deletedAt: null,
    },
    take: 200,
    orderBy: { createdAt: "asc" },
  });

  if (dtAssignment && uncontactedPeople.length >= 115) {
    // 50 strong yes / soft yes for our candidate
    const forUsData = uncontactedPeople.slice(0, 50).map((p, i) => ({
      assignmentId: dtAssignment.id,
      personId: p.id,
      outcome: "contacted" as const,
      supportLevel: i < 25 ? "strong_yes" as const : "soft_yes" as const,
      respondedAt: randomRespondedAt(),
    }));

    // 20 supporting Akshay Kumar
    const akshayData = uncontactedPeople.slice(50, 70).map((p) => ({
      assignmentId: dtAssignment.id,
      personId: p.id,
      outcome: "other_candidate" as const,
      competitorId: competitors[0].id,
      respondedAt: randomRespondedAt(),
    }));

    // 30 supporting Charles Wong
    const charlesData = uncontactedPeople.slice(70, 100).map((p) => ({
      assignmentId: dtAssignment.id,
      personId: p.id,
      outcome: "other_candidate" as const,
      competitorId: competitors[1].id,
      respondedAt: randomRespondedAt(),
    }));

    // 15 supporting Walter Smith
    const walterData = uncontactedPeople.slice(100, 115).map((p) => ({
      assignmentId: dtAssignment.id,
      personId: p.id,
      outcome: "other_candidate" as const,
      competitorId: competitors[2].id,
      respondedAt: randomRespondedAt(),
    }));

    const created = await db.canvassResponse.createMany({
      data: [...forUsData, ...akshayData, ...charlesData, ...walterData],
    });
    console.log("  Created responses:", created.count);

    console.log("  ✔ Extended canvass responses: 50 for us, 20 Akshay Kumar, 30 Charles Wong, 15 Walter Smith");
  }

  // ── Voting records ────────────────────────────────────────────────────────
  // Owen Sound municipal elections only. Fetch all 1,500 people ordered by id
  // (deterministic — no Math.random). Slice into groups by index.
  const allVotingPeople = await db.person.findMany({
    where: { campaignId: campaign.id, deletedAt: null },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const E2022 = { electionType: "municipal" as const, electionYear: 2022, electionName: "2022 Owen Sound Municipal Election", participated: true };
  const E2018 = { electionType: "municipal" as const, electionYear: 2018, electionName: "2018 Owen Sound Municipal Election", participated: true };
  const E2014 = { electionType: "municipal" as const, electionYear: 2014, electionName: "2014 Owen Sound Municipal Election", participated: true };

  // Deterministic grouping by index slice:
  // [0..224]   → three-election group (225 people, 15%)
  // [225..374] → two-election group  (150 people, 10%)
  // [375..479] → one-election group  (105 people,  7%)
  // [480..]    → no records
  const threeGroup  = allVotingPeople.slice(0, 225);
  const twoGroup    = allVotingPeople.slice(225, 375);
  const oneGroup    = allVotingPeople.slice(375, 480);

  // Two-election combos distributed evenly: 2022+2018, 2022+2014, 2018+2014
  const TWO_COMBOS = [
    [E2022, E2018],
    [E2022, E2014],
    [E2018, E2014],
  ];
  // One-election options distributed evenly: 2022, 2018, 2014
  const ONE_OPTIONS = [E2022, E2018, E2014];

  const votingRecordRows: {
    campaignId: string;
    personId: string;
    electionType: string;
    electionYear: number;
    electionName: string;
    participated: boolean;
  }[] = [];

  for (const p of threeGroup) {
    votingRecordRows.push(
      { campaignId: campaign.id, personId: p.id, ...E2022 },
      { campaignId: campaign.id, personId: p.id, ...E2018 },
      { campaignId: campaign.id, personId: p.id, ...E2014 },
    );
  }
  for (let i = 0; i < twoGroup.length; i++) {
    const combo = TWO_COMBOS[i % 3];
    for (const e of combo) {
      votingRecordRows.push({ campaignId: campaign.id, personId: twoGroup[i].id, ...e });
    }
  }
  for (let i = 0; i < oneGroup.length; i++) {
    const e = ONE_OPTIONS[i % 3];
    votingRecordRows.push({ campaignId: campaign.id, personId: oneGroup[i].id, ...e });
  }

  const voterCount = threeGroup.length + twoGroup.length + oneGroup.length;
  await (db as any).votingRecord.createMany({ data: votingRecordRows, skipDuplicates: true });
  console.log(`  ✔ Voting records: ${votingRecordRows.length} across ${voterCount} voters`);

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

  // ── Signs ─────────────────────────────────────────────────────────────────
  // Fetch a handful of residential addresses to link to.
  const signAddresses = await db.address.findMany({
    where: { campaignId: campaign.id },
    take: 5,
    orderBy: { createdAt: "asc" },
  });

  const installedAt1 = new Date(nowMs - 5 * 24 * 60 * 60 * 1000);
  const installedAt2 = new Date(nowMs - 3 * 24 * 60 * 60 * 1000);
  const installedAt3 = new Date(nowMs - 1 * 24 * 60 * 60 * 1000);
  const installedAt4 = new Date(nowMs - 2 * 24 * 60 * 60 * 1000);

  await db.sign.createMany({
    data: [
      // Residential — to be installed (5)
      { campaignId: campaign.id, status: SignStatus.to_be_installed, locationType: SignLocationType.residential, addressId: signAddresses[0]?.id, addedById: mariaSantos.id },
      { campaignId: campaign.id, status: SignStatus.to_be_installed, locationType: SignLocationType.residential, addressId: signAddresses[1]?.id, addedById: jamesOkafor.id },
      { campaignId: campaign.id, status: SignStatus.to_be_installed, locationType: SignLocationType.residential, addressId: signAddresses[2]?.id, addedById: mariaSantos.id, notes: "Resident requested large sign" },
      { campaignId: campaign.id, status: SignStatus.to_be_installed, locationType: SignLocationType.residential, addressId: signAddresses[3]?.id, addedById: sarahKim.id },
      { campaignId: campaign.id, status: SignStatus.to_be_installed, locationType: SignLocationType.residential, addressId: signAddresses[4]?.id, addedById: jamesOkafor.id, notes: "Near school — confirm placement rules" },
      // Non-residential — to be installed (1)
      { campaignId: campaign.id, status: SignStatus.to_be_installed, locationType: SignLocationType.non_residential, locationText: "Corner of 10th St E and Highway 26", addedById: mariaSantos.id },
      // Residential — installed (2)
      { campaignId: campaign.id, status: SignStatus.installed, locationType: SignLocationType.residential, addressId: signAddresses[0]?.id, addedById: mariaSantos.id, installedById: mikeDavidson.id, installedAt: installedAt1, notes: "Standard yard sign" },
      { campaignId: campaign.id, status: SignStatus.installed, locationType: SignLocationType.residential, addressId: signAddresses[1]?.id, addedById: jamesOkafor.id, installedById: mikeDavidson.id, installedAt: installedAt3 },
      // Non-residential — installed (2)
      { campaignId: campaign.id, status: SignStatus.installed, locationType: SignLocationType.non_residential, locationText: "Owen Sound Farmers Market entrance", addedById: alexChen.id, installedById: mikeDavidson.id, installedAt: installedAt2 },
      { campaignId: campaign.id, status: SignStatus.installed, locationType: SignLocationType.non_residential, locationText: "Inglis Falls Road near Conservation Area", addedById: mariaSantos.id, installedById: mikeDavidson.id, installedAt: installedAt4, notes: "Large format sign approved by property owner" },
    ],
  });
  console.log("  ✓ Signs: 10 (6 to_be_installed, 4 installed)");

  // ── Volunteer follow-up tasks ─────────────────────────────────────────────
  // 3 open volunteer_follow_up tasks assigned to the field organizer, linked
  // to distinct persons who haven't been used in the general follow-up queue.
  const volFollowUpPersons = await db.person.findMany({
    where: { campaignId: campaign.id },
    take: 3,
    skip: 120,
  });

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const FOUR_DAYS_MS  = 4 * 24 * 60 * 60 * 1000;
  const FIVE_DAYS_MS  = 5 * 24 * 60 * 60 * 1000;

  await db.task.createMany({
    data: [
      {
        campaignId: campaign.id,
        personId:   volFollowUpPersons[0].id,
        type:       "volunteer_follow_up",
        assignedTo: jamesOkafor.id,
        title:      `Follow up with volunteer: ${volFollowUpPersons[0].firstName} ${volFollowUpPersons[0].lastName}`,
        notes:      "Flagged by Priya Nair\n\nInterested in canvassing on weekends.",
        dueDate:    new Date(nowMs + THREE_DAYS_MS),
      },
      {
        campaignId: campaign.id,
        personId:   volFollowUpPersons[1].id,
        type:       "volunteer_follow_up",
        assignedTo: jamesOkafor.id,
        title:      `Follow up with volunteer: ${volFollowUpPersons[1].firstName} ${volFollowUpPersons[1].lastName}`,
        notes:      "Flagged by Kevin Lafleur\n\nCan help with sign installation.",
        dueDate:    new Date(nowMs + FOUR_DAYS_MS),
      },
      {
        campaignId: campaign.id,
        personId:   volFollowUpPersons[2].id,
        type:       "volunteer_follow_up",
        assignedTo: jamesOkafor.id,
        title:      `Follow up with volunteer: ${volFollowUpPersons[2].firstName} ${volFollowUpPersons[2].lastName}`,
        notes:      "Flagged by Amy Zhang",
        dueDate:    new Date(nowMs + FIVE_DAYS_MS),
      },
    ],
  });
  console.log("  ✓ Volunteer follow-up tasks: 3 open (assigned to field organizer)");

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
  console.log("  sign_installer        → mike.davidson@example.com");

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
