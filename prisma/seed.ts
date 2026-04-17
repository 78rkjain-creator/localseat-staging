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

import { PrismaClient, SupportLevel, CanvassOutcome, AddressChangeStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const HASH = bcrypt.hashSync("password", 12);

async function main() {
  console.log("🌱 Seeding database...");

  // ── Clean up existing seed data ──────────────────────────────────────────
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

  // ── Campaign ──────────────────────────────────────────────────────────────
  const campaign = await db.campaign.create({
    data: {
      name: "Greenfield Ward 3 — 2026",
      description:
        "Municipal election campaign for Ward 3, Greenfield, Ontario. Focus on affordable housing and transit.",
      wards: ["Ward 3", "Ward 4"],
      city: "Greenfield",
      province: "ON",
      year: 2026,
      isActive: true,
    },
  });
  console.log(`  ✓ Campaign: ${campaign.name}`);

  // ── Users ─────────────────────────────────────────────────────────────────
  const VERIFIED_NOW = new Date();
  const users = await Promise.all([
    db.user.create({
      data: {
        email: "alex.chen@example.com",
        passwordHash: HASH,
        firstName: "Alex",
        lastName: "Chen",
        phoneHome: "613-555-0100",
        emailVerified: VERIFIED_NOW,
      },
    }),
    db.user.create({
      data: {
        email: "maria.santos@example.com",
        passwordHash: HASH,
        firstName: "Maria",
        lastName: "Santos",
        phoneHome: "613-555-0101",
        emailVerified: VERIFIED_NOW,
      },
    }),
    db.user.create({
      data: {
        email: "james.okafor@example.com",
        passwordHash: HASH,
        firstName: "James",
        lastName: "Okafor",
        phoneHome: "613-555-0102",
        emailVerified: VERIFIED_NOW,
      },
    }),
    db.user.create({
      data: {
        email: "priya.nair@example.com",
        passwordHash: HASH,
        firstName: "Priya",
        lastName: "Nair",
        phoneHome: "613-555-0103",
        emailVerified: VERIFIED_NOW,
      },
    }),
    db.user.create({
      data: {
        email: "kevin.lafleur@example.com",
        passwordHash: HASH,
        firstName: "Kevin",
        lastName: "Lafleur",
        phoneHome: "613-555-0104",
        emailVerified: VERIFIED_NOW,
      },
    }),
    db.user.create({
      data: {
        email: "sara.bishop@example.com",
        passwordHash: HASH,
        firstName: "Sara",
        lastName: "Bishop",
        phoneHome: "613-555-0105",
        emailVerified: VERIFIED_NOW,
      },
    }),
    db.user.create({
      data: {
        email: "dan.wu@example.com",
        passwordHash: HASH,
        firstName: "Dan",
        lastName: "Wu",
        phoneHome: "613-555-0106",
        emailVerified: VERIFIED_NOW,
      },
    }),
    db.user.create({
      data: {
        email: "claire.morgan@example.com",
        passwordHash: HASH,
        firstName: "Claire",
        lastName: "Morgan",
        phoneHome: "613-555-0107",
        emailVerified: VERIFIED_NOW,
      },
    }),
  ]);

  const [candidate, manager, organizer, canvasser1, canvasser2, volCoord, finance, cochair] = users;
  console.log(`  ✓ Users: ${users.map((u) => u.firstName).join(", ")}`);

  // ── Platform super user (no campaign membership) ──────────────────────────
  await db.user.upsert({
    where: { email: "superuser@localseat.io" },
    create: {
      email: "superuser@localseat.io",
      passwordHash: HASH,
      firstName: "Super",
      lastName: "User",
      isActive: true,
      platformRole: "super_user",
      emailVerified: new Date(),
    },
    update: { platformRole: "super_user", emailVerified: new Date() },
  });
  console.log("  ✓ Platform super user: superuser@localseat.io");

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
      { userId: cochair.id, campaignId: campaign.id, role: "co_chair" },
    ],
  });
  console.log("  ✓ Campaign memberships (8 members including co_chair)");

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
  await db.canvassAssignment.create({
    data: {
      canvassListId: walkList.id,
      canvasserId: canvasser2.id,
      notes: "Focus on the odd-numbered houses. Introduce yourself and leave a flyer.",
    },
  });
  console.log("  ✓ Canvass assignments");

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

  // ── Volunteer Records ─────────────────────────────────────────────────────
  // Auto-create volunteer records for responses with volunteerInterest: true
  const volunteerPersonIds = responseData
    .filter((r) => r.volunteerInterest)
    .map((r) => r.personId);

  await db.volunteerRecord.createMany({
    data: volunteerPersonIds.map((personId) => ({
      campaignId: campaign.id,
      personId,
      status: "interested",
    })),
  });
  console.log(`  ✓ Volunteer records: ${volunteerPersonIds.length}`);

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

  // ── Address Change Requests (3 pending — for review flow testing) ─────────
  await db.addressChangeRequest.createMany({
    data: [
      {
        // Submitted by canvasser (priya) — moving Susan Tran from 18 Elm to 45 Oak Ave
        campaignId: campaign.id,
        requestedByUserId: canvasser1.id,
        personId: people[4].id,  // Susan Tran
        affectedPersonIds: [people[4].id],
        oldAddressId: addresses[2].id,  // 18 Elm Street
        newAddressData: {
          streetNumber: "45",
          streetName: "Oak Avenue",
          city: "Greenfield",
          province: "ON",
          postalCode: "K1B 2C3",
        },
        status: AddressChangeStatus.pending,
      },
      {
        // Submitted by field organizer — moving the Ibrahim household to 55 Cedar Dr
        campaignId: campaign.id,
        requestedByUserId: organizer.id,
        personId: people[2].id,  // Yusuf Ibrahim
        affectedPersonIds: [people[2].id, people[3].id],  // Both Ibrahims
        oldAddressId: addresses[1].id,  // 16 Elm Street
        newAddressData: {
          streetNumber: "55",
          streetName: "Cedar Drive",
          city: "Greenfield",
          province: "ON",
          postalCode: "K1C 3D4",
        },
        status: AddressChangeStatus.pending,
      },
      {
        // Submitted by canvasser (kevin) — moving Marcus Dupont to 201 Birch Blvd
        campaignId: campaign.id,
        requestedByUserId: canvasser2.id,
        personId: people[7].id,  // Marcus Dupont
        affectedPersonIds: [people[7].id],
        oldAddressId: addresses[4].id,  // 22 Elm Street
        newAddressData: {
          streetNumber: "201",
          streetName: "Birch Boulevard",
          city: "Greenfield",
          province: "ON",
          postalCode: "K1D 4E5",
        },
        status: AddressChangeStatus.pending,
      },
    ],
  });
  console.log("  ✓ Address change requests: 3 pending");

  // ── Donors ────────────────────────────────────────────────────────────────
  await db.donor.createMany({
    data: [
      {
        campaignId: campaign.id,
        firstName: people[0].firstName,
        lastName: people[0].lastName,
        linkedPersonId: people[0].id,
        status: "interested",
        createdById: canvasser1.id,
        notes: "Expressed strong interest at door — mentioned $500.",
      },
      {
        campaignId: campaign.id,
        firstName: people[14].firstName,
        lastName: people[14].lastName,
        linkedPersonId: people[14].id,
        status: "pledged",
        amount: 250,
        donationDate: new Date(),
        paymentMethod: "cheque",
        createdById: manager.id,
        notes: "Raj Patel — local business owner. Previous donor to other campaigns.",
      },
    ],
  });
  console.log("  ✓ Donors");

  // ── Audit Log (60+ realistic entries spanning the last 30 days) ──────────
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

  await db.auditLog.createMany({
    data: [
      // ── Account & terms ──────────────────────────────────────────────────
      { userId: candidate.id, action: "TERMS_ACCEPTED", entityType: "user", entityId: candidate.id, createdAt: daysAgo(30), after: { termsVersion: "1.1", termsSignedName: "Alex Chen", ip: "192.168.1.10" } },
      { userId: manager.id, action: "TERMS_ACCEPTED", entityType: "user", entityId: manager.id, createdAt: daysAgo(29), after: { termsVersion: "1.1", termsSignedName: "Maria Santos", ip: "192.168.1.11" } },
      { userId: organizer.id, action: "TERMS_ACCEPTED", entityType: "user", entityId: organizer.id, createdAt: daysAgo(28), after: { termsVersion: "1.1", termsSignedName: "James Okafor", ip: "192.168.1.12" } },
      { userId: canvasser1.id, action: "TERMS_ACCEPTED", entityType: "user", entityId: canvasser1.id, createdAt: daysAgo(27), after: { termsVersion: "1.1", termsSignedName: "Priya Nair", ip: "192.168.1.13" } },
      { userId: canvasser2.id, action: "TERMS_ACCEPTED", entityType: "user", entityId: canvasser2.id, createdAt: daysAgo(26), after: { termsVersion: "1.1", termsSignedName: "Kevin Lafleur", ip: "192.168.1.14" } },
      // ── Logins ────────────────────────────────────────────────────────────
      { campaignId: campaign.id, userId: candidate.id, action: "LOGIN", entityType: "user", entityId: candidate.id, createdAt: daysAgo(25) },
      { campaignId: campaign.id, userId: manager.id, action: "LOGIN", entityType: "user", entityId: manager.id, createdAt: daysAgo(24) },
      { campaignId: campaign.id, userId: organizer.id, action: "LOGIN", entityType: "user", entityId: organizer.id, createdAt: daysAgo(24) },
      { campaignId: campaign.id, userId: canvasser1.id, action: "LOGIN", entityType: "user", entityId: canvasser1.id, createdAt: daysAgo(22) },
      { campaignId: campaign.id, userId: canvasser2.id, action: "LOGIN", entityType: "user", entityId: canvasser2.id, createdAt: daysAgo(22) },
      { campaignId: campaign.id, userId: manager.id, action: "LOGIN", entityType: "user", entityId: manager.id, createdAt: daysAgo(18) },
      { campaignId: campaign.id, userId: candidate.id, action: "LOGIN", entityType: "user", entityId: candidate.id, createdAt: daysAgo(10) },
      { campaignId: campaign.id, userId: manager.id, action: "LOGIN", entityType: "user", entityId: manager.id, createdAt: daysAgo(5) },
      { campaignId: campaign.id, userId: organizer.id, action: "LOGIN", entityType: "user", entityId: organizer.id, createdAt: daysAgo(3) },
      { campaignId: campaign.id, userId: canvasser1.id, action: "LOGIN", entityType: "user", entityId: canvasser1.id, createdAt: daysAgo(1) },
      // ── Logouts ───────────────────────────────────────────────────────────
      { campaignId: campaign.id, userId: canvasser1.id, action: "LOGOUT", entityType: "user", entityId: canvasser1.id, createdAt: daysAgo(22) },
      { campaignId: campaign.id, userId: canvasser2.id, action: "LOGOUT", entityType: "user", entityId: canvasser2.id, createdAt: daysAgo(22) },
      { campaignId: campaign.id, userId: organizer.id, action: "LOGOUT", entityType: "user", entityId: organizer.id, createdAt: daysAgo(3) },
      // ── Canvass responses ─────────────────────────────────────────────────
      { campaignId: campaign.id, userId: canvasser1.id, action: "CANVASS_RESPONSE_SAVED", entityType: "canvass_response", entityId: people[0].id, createdAt: daysAgo(1), after: { outcome: "contacted", supportLevel: "strong_yes", signRequest: true, donorInterest: true } },
      { campaignId: campaign.id, userId: canvasser1.id, action: "CANVASS_RESPONSE_SAVED", entityType: "canvass_response", entityId: people[1].id, createdAt: daysAgo(1), after: { outcome: "contacted", supportLevel: "soft_yes" } },
      { campaignId: campaign.id, userId: canvasser1.id, action: "CANVASS_RESPONSE_SAVED", entityType: "canvass_response", entityId: people[2].id, createdAt: daysAgo(1), after: { outcome: "contacted", supportLevel: "strong_yes", volunteerInterest: true } },
      { campaignId: campaign.id, userId: canvasser1.id, action: "CANVASS_RESPONSE_SAVED", entityType: "canvass_response", entityId: people[4].id, createdAt: daysAgo(1), after: { outcome: "not_home" } },
      { campaignId: campaign.id, userId: canvasser1.id, action: "CANVASS_RESPONSE_SAVED", entityType: "canvass_response", entityId: people[5].id, createdAt: daysAgo(1), after: { outcome: "contacted", supportLevel: "undecided" } },
      { campaignId: campaign.id, userId: canvasser2.id, action: "CANVASS_RESPONSE_SAVED", entityType: "canvass_response", entityId: people[7].id, createdAt: daysAgo(1), after: { outcome: "contacted", supportLevel: "soft_no" } },
      // ── Notes ─────────────────────────────────────────────────────────────
      { campaignId: campaign.id, userId: manager.id, action: "NOTE_ADDED", entityType: "person", entityId: people[0].id, createdAt: daysAgo(20), after: { body: "Patricia — good donor contact" } },
      { campaignId: campaign.id, userId: organizer.id, action: "NOTE_ADDED", entityType: "person", entityId: people[2].id, createdAt: daysAgo(15), after: { body: "Yusuf — weekend volunteer" } },
      { campaignId: campaign.id, userId: canvasser1.id, action: "NOTE_ADDED", entityType: "person", entityId: people[11].id, createdAt: daysAgo(1), after: { body: "Trevor — yard sign in window" } },
      // ── Follow-ups ────────────────────────────────────────────────────────
      { campaignId: campaign.id, userId: manager.id, action: "FOLLOW_UP_CREATED", entityType: "task", entityId: people[0].id, createdAt: daysAgo(20), after: { title: "Follow up re: donation interest", dueDate: daysAgo(-7).toISOString() } },
      { campaignId: campaign.id, userId: organizer.id, action: "FOLLOW_UP_CREATED", entityType: "task", entityId: people[2].id, createdAt: daysAgo(15), after: { title: "Call re: volunteer availability" } },
      { campaignId: campaign.id, userId: canvasser1.id, action: "FOLLOW_UP_CREATED", entityType: "task", entityId: people[4].id, createdAt: daysAgo(1), after: { title: "Return visit — not home" } },
      { campaignId: campaign.id, userId: manager.id, action: "FOLLOW_UP_COMPLETED", entityType: "task", entityId: people[0].id, createdAt: daysAgo(14), before: { completed: false }, after: { completed: true } },
      // ── Address change requests ───────────────────────────────────────────
      { campaignId: campaign.id, userId: canvasser1.id, action: "ADDRESS_CHANGE_REQUESTED", entityType: "address_change_request", entityId: people[4].id, createdAt: daysAgo(5), after: { newAddress: "45 Oak Avenue, Greenfield ON" } },
      { campaignId: campaign.id, userId: organizer.id, action: "ADDRESS_CHANGE_REQUESTED", entityType: "address_change_request", entityId: people[2].id, createdAt: daysAgo(4), after: { newAddress: "55 Cedar Drive, Greenfield ON" } },
      { campaignId: campaign.id, userId: canvasser2.id, action: "ADDRESS_CHANGE_REQUESTED", entityType: "address_change_request", entityId: people[7].id, createdAt: daysAgo(2), after: { newAddress: "201 Birch Boulevard, Greenfield ON" } },
      // ── Exports ───────────────────────────────────────────────────────────
      { campaignId: campaign.id, userId: manager.id, action: "ADMIN_EXPORT", entityType: "voter_list", entityId: campaign.id, createdAt: daysAgo(18), after: { format: "csv", count: 20 } },
      { campaignId: campaign.id, userId: finance.id, action: "ADMIN_EXPORT", entityType: "donor_list", entityId: campaign.id, createdAt: daysAgo(12), after: { format: "csv", count: 2 } },
      { campaignId: campaign.id, userId: manager.id, action: "ADMIN_EXPORT", entityType: "volunteer_list", entityId: campaign.id, createdAt: daysAgo(7), after: { format: "csv", count: 1 } },
      { campaignId: campaign.id, userId: organizer.id, action: "ADMIN_EXPORT", entityType: "outreach_history", entityId: campaign.id, createdAt: daysAgo(3), after: { format: "csv", count: 2 } },
      // ── Team management ───────────────────────────────────────────────────
      { campaignId: campaign.id, userId: candidate.id, action: "MEMBER_ADDED", entityType: "campaign_membership", entityId: manager.id, createdAt: daysAgo(29), after: { targetUserId: manager.id, role: "campaign_manager" } },
      { campaignId: campaign.id, userId: manager.id, action: "MEMBER_ADDED", entityType: "campaign_membership", entityId: organizer.id, createdAt: daysAgo(28), after: { targetUserId: organizer.id, role: "field_organizer" } },
      { campaignId: campaign.id, userId: manager.id, action: "MEMBER_ADDED", entityType: "campaign_membership", entityId: canvasser1.id, createdAt: daysAgo(27), after: { targetUserId: canvasser1.id, role: "canvasser" } },
      { campaignId: campaign.id, userId: manager.id, action: "MEMBER_ADDED", entityType: "campaign_membership", entityId: canvasser2.id, createdAt: daysAgo(27), after: { targetUserId: canvasser2.id, role: "canvasser" } },
      { campaignId: campaign.id, userId: manager.id, action: "MEMBER_ADDED", entityType: "campaign_membership", entityId: volCoord.id, createdAt: daysAgo(26), after: { targetUserId: volCoord.id, role: "volunteer_coordinator" } },
      { campaignId: campaign.id, userId: manager.id, action: "MEMBER_ADDED", entityType: "campaign_membership", entityId: finance.id, createdAt: daysAgo(26), after: { targetUserId: finance.id, role: "finance_lead" } },
      { campaignId: campaign.id, userId: candidate.id, action: "ROLE_CHANGED", entityType: "campaign_membership", entityId: cochair.id, createdAt: daysAgo(20), before: { role: "campaign_manager" }, after: { role: "co_chair" } },
      // ── Voter data imports ────────────────────────────────────────────────
      { campaignId: campaign.id, userId: manager.id, action: "VOTER_LIST_IMPORTED", entityType: "campaign", entityId: campaign.id, createdAt: daysAgo(25), after: { recordsImported: 20, fileName: "ward3_voters.csv" } },
      // ── Canvass list management ───────────────────────────────────────────
      { campaignId: campaign.id, userId: organizer.id, action: "CANVASS_LIST_CREATED", entityType: "canvass_list", entityId: walkList.id, createdAt: daysAgo(24), after: { name: "Elm Street Block — Round 1" } },
      { campaignId: campaign.id, userId: organizer.id, action: "CANVASS_ASSIGNMENT_CREATED", entityType: "canvass_assignment", entityId: assignment.id, createdAt: daysAgo(23), after: { canvasserId: canvasser1.id, listName: "Elm Street Block — Round 1" } },
      // ── Password reset ────────────────────────────────────────────────────
      { campaignId: campaign.id, userId: canvasser2.id, action: "PASSWORD_RESET_REQUESTED", entityType: "user", entityId: canvasser2.id, createdAt: daysAgo(14) },
      { campaignId: campaign.id, userId: canvasser2.id, action: "PASSWORD_RESET_COMPLETED", entityType: "user", entityId: canvasser2.id, createdAt: daysAgo(14) },
      // ── Donor management ─────────────────────────────────────────────────
      { campaignId: campaign.id, userId: canvasser1.id, action: "DONOR_PROSPECT_CREATED", entityType: "donor", entityId: people[0].id, createdAt: daysAgo(1), after: { name: "Patricia Wallace", status: "interested" } },
      { campaignId: campaign.id, userId: manager.id, action: "DONOR_PLEDGE_RECORDED", entityType: "donor", entityId: people[14].id, createdAt: daysAgo(10), after: { name: "Raj Patel", amount: 250, paymentMethod: "cheque" } },
      // ── Misc logins (round out to 60+) ────────────────────────────────────
      { campaignId: campaign.id, userId: finance.id, action: "LOGIN", entityType: "user", entityId: finance.id, createdAt: daysAgo(12) },
      { campaignId: campaign.id, userId: volCoord.id, action: "LOGIN", entityType: "user", entityId: volCoord.id, createdAt: daysAgo(9) },
      { campaignId: campaign.id, userId: cochair.id, action: "LOGIN", entityType: "user", entityId: cochair.id, createdAt: daysAgo(8) },
      { campaignId: campaign.id, userId: finance.id, action: "LOGOUT", entityType: "user", entityId: finance.id, createdAt: daysAgo(12) },
      { campaignId: campaign.id, userId: volCoord.id, action: "LOGOUT", entityType: "user", entityId: volCoord.id, createdAt: daysAgo(9) },
      { campaignId: campaign.id, userId: canvasser1.id, action: "CANVASS_RESPONSE_SAVED", entityType: "canvass_response", entityId: people[8].id, createdAt: hoursAgo(6), after: { outcome: "contacted", supportLevel: "strong_yes", signRequest: true } },
      { campaignId: campaign.id, userId: canvasser1.id, action: "CANVASS_RESPONSE_SAVED", entityType: "canvass_response", entityId: people[9].id, createdAt: hoursAgo(6), after: { outcome: "contacted", supportLevel: "soft_yes" } },
      { campaignId: campaign.id, userId: canvasser2.id, action: "CANVASS_RESPONSE_SAVED", entityType: "canvass_response", entityId: people[10].id, createdAt: hoursAgo(5), after: { outcome: "not_home", needsFollowUp: true } },
      { campaignId: campaign.id, userId: canvasser2.id, action: "CANVASS_RESPONSE_SAVED", entityType: "canvass_response", entityId: people[11].id, createdAt: hoursAgo(5), after: { outcome: "contacted", supportLevel: "strong_yes", signRequest: true, volunteerInterest: true } },
      { campaignId: campaign.id, userId: manager.id, action: "FOLLOW_UP_CREATED", entityType: "task", entityId: people[8].id, createdAt: hoursAgo(4), after: { title: "Confirm sign location for Fatima Al-Hassan" } },
      // ── Seed marker ───────────────────────────────────────────────────────
      { userId: manager.id, action: "seed", entityType: "campaign", entityId: campaign.id, after: { note: "Database seeded for development" } },
    ],
  });
  console.log("  ✓ Audit log: 60+ entries");

  console.log("\n✅ Seed complete.\n");
  console.log("Test credentials (all passwords: 'password'):");
  console.log("  candidate         → alex.chen@example.com");
  console.log("  campaign_manager  → maria.santos@example.com");
  console.log("  field_organizer   → james.okafor@example.com");
  console.log("  canvasser         → priya.nair@example.com");
  console.log("  canvasser         → kevin.lafleur@example.com");
  console.log("  volunteer_coord   → sara.bishop@example.com");
  console.log("  finance_lead      → dan.wu@example.com");
  console.log("  co_chair          → claire.morgan@example.com");
  console.warn("⚠️  Campaign IDs have changed. Sign out and sign back in to refresh your session.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
