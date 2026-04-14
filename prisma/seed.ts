/**
 * Seed script for LocalSeat development.
 *
 * Creates:
 *   - 1 campaign (Greenfield Ward 3 — 2026)
 *   - 7 users covering all roles (password: "password" for all)
 *   - 12 addresses in a realistic Canadian neighbourhood
 *   - 12 households
 *   - 20 residents
 *   - 1 walk list with 1 canvass assignment
 *   - Sample canvass responses
 *   - Sample notes, tasks, and donor prospect records
 *
 * Run: npm run db:seed
 */

import { PrismaClient, SupportLevel, CanvassOutcome } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const HASH = bcrypt.hashSync("password", 12);

async function main() {
  console.log("🌱 Seeding database...");

  // ── Clean up existing seed data ──────────────────────────────────────────
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.donorRecord.deleteMany(),
    db.outreachLog.deleteMany(),
    db.canvassResponse.deleteMany(),
    db.canvassAssignment.deleteMany(),
    db.canvassListEntry.deleteMany(),
    db.canvassList.deleteMany(),
    db.task.deleteMany(),
    db.note.deleteMany(),
    db.personTag.deleteMany(),
    db.tag.deleteMany(),
    db.person.deleteMany(),
    db.household.deleteMany(),
    db.address.deleteMany(),
    db.campaignMembership.deleteMany(),
    db.campaign.deleteMany(),
    db.user.deleteMany(),
  ]);

  // ── Campaign ──────────────────────────────────────────────────────────────
  const campaign = await db.campaign.create({
    data: {
      name: "Greenfield Ward 3 — 2026",
      description:
        "Municipal election campaign for Ward 3, Greenfield, Ontario. Focus on affordable housing and transit.",
      ward: "Ward 3",
      city: "Greenfield",
      province: "ON",
      year: 2026,
      isActive: true,
    },
  });
  console.log(`  ✓ Campaign: ${campaign.name}`);

  // ── Users ─────────────────────────────────────────────────────────────────
  const users = await Promise.all([
    db.user.create({
      data: {
        email: "alex.chen@example.com",
        passwordHash: HASH,
        firstName: "Alex",
        lastName: "Chen",
        phone: "613-555-0100",
      },
    }),
    db.user.create({
      data: {
        email: "maria.santos@example.com",
        passwordHash: HASH,
        firstName: "Maria",
        lastName: "Santos",
        phone: "613-555-0101",
      },
    }),
    db.user.create({
      data: {
        email: "james.okafor@example.com",
        passwordHash: HASH,
        firstName: "James",
        lastName: "Okafor",
        phone: "613-555-0102",
      },
    }),
    db.user.create({
      data: {
        email: "priya.nair@example.com",
        passwordHash: HASH,
        firstName: "Priya",
        lastName: "Nair",
        phone: "613-555-0103",
      },
    }),
    db.user.create({
      data: {
        email: "kevin.lafleur@example.com",
        passwordHash: HASH,
        firstName: "Kevin",
        lastName: "Lafleur",
        phone: "613-555-0104",
      },
    }),
    db.user.create({
      data: {
        email: "sara.bishop@example.com",
        passwordHash: HASH,
        firstName: "Sara",
        lastName: "Bishop",
        phone: "613-555-0105",
      },
    }),
    db.user.create({
      data: {
        email: "dan.wu@example.com",
        passwordHash: HASH,
        firstName: "Dan",
        lastName: "Wu",
        phone: "613-555-0106",
      },
    }),
  ]);

  const [candidate, manager, organizer, canvasser1, canvasser2, volCoord, finance] = users;
  console.log(`  ✓ Users: ${users.map((u) => u.firstName).join(", ")}`);

  // ── Campaign Memberships ──────────────────────────────────────────────────
  await db.campaignMembership.createMany({
    data: [
      { userId: candidate.id, campaignId: campaign.id, role: "candidate" },
      { userId: manager.id, campaignId: campaign.id, role: "campaign_manager" },
      { userId: organizer.id, campaignId: campaign.id, role: "field_organizer" },
      { userId: canvasser1.id, campaignId: campaign.id, role: "canvasser" },
      { userId: canvasser2.id, campaignId: campaign.id, role: "canvasser" },
      { userId: volCoord.id, campaignId: campaign.id, role: "volunteer_coordinator" },
      { userId: finance.id, campaignId: campaign.id, role: "finance_lead" },
    ],
  });
  console.log("  ✓ Campaign memberships");

  // ── Tags ──────────────────────────────────────────────────────────────────
  const [tagVoter, tagVolunteer, tagDonorProspect, tagSignYard, tagUndecided] =
    await Promise.all([
      db.tag.create({ data: { name: "Voter", color: "#6b7280" } }),
      db.tag.create({ data: { name: "Volunteer", color: "#4d7a5a" } }),
      db.tag.create({ data: { name: "Donor Prospect", color: "#ea6c0a" } }),
      db.tag.create({ data: { name: "Yard Sign", color: "#2563eb" } }),
      db.tag.create({ data: { name: "Undecided", color: "#d97706" } }),
      // System tags — created by automated flows, not manually by users
      db.tag.create({ data: { name: "field-entry", color: "#475569" } }),
      db.tag.create({ data: { name: "record-outdated", color: "#dc2626" } }),
    ]);
  console.log("  ✓ Tags (including system tags: field-entry, record-outdated)");

  // ── Addresses (Elm Street block, Greenfield ON) ───────────────────────────
  const addressData = [
    { streetNumber: "14", streetName: "Elm Street" },
    { streetNumber: "16", streetName: "Elm Street" },
    { streetNumber: "18", streetName: "Elm Street" },
    { streetNumber: "20", streetName: "Elm Street" },
    { streetNumber: "22", streetName: "Elm Street" },
    { streetNumber: "24", streetName: "Elm Street" },
    { streetNumber: "26", streetName: "Elm Street" },
    { streetNumber: "28", streetName: "Elm Street" },
    { streetNumber: "30", streetName: "Elm Street" },
    { streetNumber: "32", streetName: "Elm Street" },
    { streetNumber: "101", streetName: "Maple Avenue" },
    { streetNumber: "103", streetName: "Maple Avenue" },
  ];

  const addresses = await Promise.all(
    addressData.map((a) =>
      db.address.create({
        data: {
          ...a,
          city: "Greenfield",
          province: "ON",
          postalCode: "K1A 0B1",
          campaignId: campaign.id,
        },
      })
    )
  );
  console.log(`  ✓ Addresses: ${addresses.length}`);

  // ── Households ────────────────────────────────────────────────────────────
  const households = await Promise.all(
    addresses.map((addr, i) =>
      db.household.create({
        data: {
          campaignId: campaign.id,
          addressId: addr.id,
          name: null, // populated from resident last names after creation
        },
      })
    )
  );
  console.log(`  ✓ Households: ${households.length}`);

  // ── Residents ─────────────────────────────────────────────────────────────
  const residentData = [
    // 14 Elm
    { firstName: "Patricia", lastName: "Wallace", birthYear: 1962, householdIdx: 0 },
    { firstName: "Robert", lastName: "Wallace", birthYear: 1960, householdIdx: 0 },
    // 16 Elm
    { firstName: "Yusuf", lastName: "Ibrahim", birthYear: 1984, householdIdx: 1 },
    { firstName: "Amina", lastName: "Ibrahim", birthYear: 1986, householdIdx: 1 },
    // 18 Elm
    { firstName: "Susan", lastName: "Tran", birthYear: 1945, householdIdx: 2 },
    // 20 Elm
    { firstName: "David", lastName: "Kowalski", birthYear: 1978, householdIdx: 3 },
    { firstName: "Lena", lastName: "Kowalski", birthYear: 1980, householdIdx: 3 },
    // 22 Elm
    { firstName: "Marcus", lastName: "Dupont", birthYear: 1992, householdIdx: 4 },
    // 24 Elm
    { firstName: "Fatima", lastName: "Al-Hassan", birthYear: 1970, householdIdx: 5 },
    { firstName: "Omar", lastName: "Al-Hassan", birthYear: 1968, householdIdx: 5 },
    // 26 Elm
    { firstName: "Carol", lastName: "Nzinga", birthYear: 1955, householdIdx: 6 },
    // 28 Elm
    { firstName: "Trevor", lastName: "Sinclair", birthYear: 1987, householdIdx: 7 },
    { firstName: "Jennifer", lastName: "Sinclair", birthYear: 1989, householdIdx: 7 },
    // 30 Elm
    { firstName: "Helen", lastName: "Park", birthYear: 1933, householdIdx: 8 },
    // 32 Elm
    { firstName: "Raj", lastName: "Patel", birthYear: 1975, householdIdx: 9 },
    { firstName: "Deepa", lastName: "Patel", birthYear: 1977, householdIdx: 9 },
    // 101 Maple
    { firstName: "Olivia", lastName: "Morrison", birthYear: 1998, householdIdx: 10 },
    { firstName: "Ethan", lastName: "Morrison", birthYear: 1996, householdIdx: 10 },
    // 103 Maple
    { firstName: "Claude", lastName: "Beaumont", birthYear: 1952, householdIdx: 11 },
    { firstName: "Sylvie", lastName: "Beaumont", birthYear: 1954, householdIdx: 11 },
  ];

  const people = await Promise.all(
    residentData.map((r) =>
      db.person.create({
        data: {
          campaignId: campaign.id,
          householdId: households[r.householdIdx].id,
          firstName: r.firstName,
          lastName: r.lastName,
          birthYear: r.birthYear,
        },
      })
    )
  );
  console.log(`  ✓ Residents: ${people.length}`);

  // ── Assign some tags ──────────────────────────────────────────────────────
  const tagAssignments = [
    { person: people[0], tags: [tagVoter, tagDonorProspect] },
    { person: people[1], tags: [tagVoter] },
    { person: people[2], tags: [tagVoter, tagVolunteer] },
    { person: people[3], tags: [tagVoter] },
    { person: people[4], tags: [tagVoter, tagSignYard] },
    { person: people[7], tags: [tagVoter, tagUndecided] },
    { person: people[11], tags: [tagVoter, tagVolunteer, tagSignYard] },
    { person: people[14], tags: [tagVoter, tagDonorProspect] },
    { person: people[16], tags: [tagVoter, tagUndecided] },
  ];

  await Promise.all(
    tagAssignments.flatMap(({ person, tags }) =>
      tags.map((tag) =>
        db.personTag.create({ data: { personId: person.id, tagId: tag.id } })
      )
    )
  );
  console.log("  ✓ Person tags");

  // ── Notes ─────────────────────────────────────────────────────────────────
  await db.note.createMany({
    data: [
      {
        personId: people[0].id,
        authorId: manager.id,
        body: "Patricia has been a longtime community advocate. Good contact for donor outreach.",
      },
      {
        personId: people[2].id,
        authorId: organizer.id,
        body: "Yusuf expressed interest in volunteering on weekends. Follow up in September.",
      },
      {
        personId: people[11].id,
        authorId: canvasser1.id,
        body: "Trevor put a yard sign in his front window — very enthusiastic.",
      },
    ],
  });
  console.log("  ✓ Notes");

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const overdue = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);

  await db.task.createMany({
    data: [
      {
        campaignId: campaign.id,
        personId: people[0].id,
        assignedTo: manager.id,
        title: "Follow up re: donation interest",
        dueDate: nextWeek,
        notes: "Patricia mentioned she might be able to contribute $500.",
      },
      {
        campaignId: campaign.id,
        personId: people[2].id,
        assignedTo: organizer.id,
        title: "Call re: volunteer availability",
        dueDate: overdue,
        notes: "Yusuf said he has time on weekends.",
      },
      {
        campaignId: campaign.id,
        assignedTo: manager.id,
        title: "Import remaining voter data from city registry",
        dueDate: nextWeek,
      },
    ],
  });
  console.log("  ✓ Tasks");

  // ── Walk List ──────────────────────────────────────────────────────────────
  const walkList = await db.canvassList.create({
    data: {
      campaignId: campaign.id,
      name: "Elm Street Block — Round 1",
      description: "Initial door knock on Elm Street between 14 and 32.",
    },
  });
  console.log(`  ✓ Walk list: ${walkList.name}`);

  // ── Canvass Assignment ────────────────────────────────────────────────────
  const assignment = await db.canvassAssignment.create({
    data: {
      canvassListId: walkList.id,
      canvasserId: canvasser1.id,
      notes: "Focus on the even-numbered houses. Bring door-knocker pamphlets.",
    },
  });
  console.log("  ✓ Canvass assignment");

  // ── Canvass List Entries (Elm Street residents on the list) ───────────────
  // people[0]–people[15] are the 16 Elm Street residents (14–32 Elm)
  await db.canvassListEntry.createMany({
    data: people.slice(0, 16).map((p) => ({
      canvassListId: walkList.id,
      personId: p.id,
      addedById: manager.id,
    })),
    skipDuplicates: true,
  });
  console.log("  ✓ Canvass list entries: 16");

  // ── Canvass Responses (sample — first 6 addresses completed) ─────────────
  const responseData = [
    // 14 Elm — Patricia Wallace
    {
      personId: people[0].id,
      outcome: CanvassOutcome.contacted,
      supportLevel: SupportLevel.strong_yes,
      signRequest: true,
      volunteerInterest: false,
      donorInterest: true,
      needsFollowUp: true,
      notes: "Very supportive. Wants to talk about donations.",
    },
    // 14 Elm — Robert Wallace
    {
      personId: people[1].id,
      outcome: CanvassOutcome.contacted,
      supportLevel: SupportLevel.soft_yes,
      signRequest: false,
      volunteerInterest: false,
      donorInterest: false,
      needsFollowUp: false,
    },
    // 16 Elm — Yusuf Ibrahim
    {
      personId: people[2].id,
      outcome: CanvassOutcome.contacted,
      supportLevel: SupportLevel.strong_yes,
      signRequest: false,
      volunteerInterest: true,
      donorInterest: false,
      needsFollowUp: true,
      notes: "Wants to volunteer on weekends.",
    },
    // 18 Elm — Susan Tran (not home)
    {
      personId: people[4].id,
      outcome: CanvassOutcome.not_home,
      needsFollowUp: true,
    },
    // 20 Elm — David Kowalski
    {
      personId: people[5].id,
      outcome: CanvassOutcome.contacted,
      supportLevel: SupportLevel.undecided,
      signRequest: false,
      volunteerInterest: false,
      donorInterest: false,
      notes: "Concerned about local transit cuts. Wants more info.",
    },
    // 22 Elm — Marcus Dupont
    {
      personId: people[7].id,
      outcome: CanvassOutcome.contacted,
      supportLevel: SupportLevel.soft_no,
      notes: "Not interested — prefers another candidate.",
    },
  ];

  await db.canvassResponse.createMany({
    data: responseData.map((r) => ({
      assignmentId: assignment.id,
      ...r,
    })),
  });
  console.log(`  ✓ Canvass responses: ${responseData.length}`);

  // ── Outreach Logs ─────────────────────────────────────────────────────────
  await db.outreachLog.createMany({
    data: [
      {
        campaignId: campaign.id,
        personId: people[0].id,
        userId: canvasser1.id,
        channel: "door_knock",
        date: new Date(),
        notes: "Canvass visit — strong support, follow-up requested.",
      },
      {
        campaignId: campaign.id,
        personId: people[2].id,
        userId: canvasser1.id,
        channel: "door_knock",
        date: new Date(),
        notes: "Canvass visit — volunteer interest captured.",
      },
    ],
  });
  console.log("  ✓ Outreach logs");

  // ── Donor Prospects ───────────────────────────────────────────────────────
  await db.donorRecord.createMany({
    data: [
      {
        campaignId: campaign.id,
        personId: people[0].id,
        prospectOnly: true,
        flaggedById: canvasser1.id,
        flaggedAt: new Date(),
        notes: "Expressed strong interest at door — mentioned $500.",
      },
      {
        campaignId: campaign.id,
        personId: people[14].id,
        prospectOnly: true,
        flaggedById: manager.id,
        flaggedAt: new Date(),
        notes: "Raj Patel — local business owner. Previous donor to other campaigns.",
      },
    ],
  });
  console.log("  ✓ Donor prospects");

  // ── Audit Log ─────────────────────────────────────────────────────────────
  await db.auditLog.create({
    data: {
      campaignId: campaign.id,
      userId: manager.id,
      action: "seed",
      entityType: "campaign",
      entityId: campaign.id,
      after: { note: "Database seeded for development" },
    },
  });
  console.log("  ✓ Audit log");

  console.log("\n✅ Seed complete.\n");
  console.log("Test credentials (all passwords: 'password'):");
  console.log("  candidate         → alex.chen@example.com");
  console.log("  campaign_manager  → maria.santos@example.com");
  console.log("  field_organizer   → james.okafor@example.com");
  console.log("  canvasser         → priya.nair@example.com");
  console.log("  canvasser         → kevin.lafleur@example.com");
  console.log("  volunteer_coord   → sara.bishop@example.com");
  console.log("  finance_lead      → dan.wu@example.com");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
