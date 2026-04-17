/**
 * Test — Export Routes: Membership Revocation Scenarios
 *
 * Verifies that all 3 export routes correctly enforce campaign membership
 * re-verification for a user who holds a valid JWT session.
 *
 * 4 cases per route (12 total):
 *   1. Active membership (deletedAt: null)  → 200
 *   2. No membership record (findFirst: null)  → 403
 *   3. Membership soft-deleted (deletedAt not null, simulated as null return)  → 403
 *   4. Membership exists but for a different campaignId (findFirst returns null
 *      because the where clause includes the session's campaignId)  → 403
 *
 * The critical case is #3: a revoked user whose deletedAt is set must be blocked
 * even though their JWT session still looks valid.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('@/lib/permissions', () => ({
  canViewDonors: jest.fn(),
  canViewDonorAmounts: jest.fn(),
  canViewVolunteers: jest.fn(),
  canManageFollowUps: jest.fn(),
}));

// Prevent real DB calls from lib/donors
jest.mock('@/lib/donors', () => ({
  getAllDonorsForExport: jest.fn(),
}));

// Prevent real DB calls from lib/outreach
jest.mock('@/lib/outreach', () => ({
  getAllOutreachLogsForExport: jest.fn(),
}));

// Prevent real audit-log DB calls
jest.mock('@/lib/audit', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

// Mock the Prisma client entirely — no real DB connections
jest.mock('@/lib/db', () => ({
  db: {
    campaignMembership: {
      findFirst: jest.fn(),
    },
    canvassResponse: {
      findMany: jest.fn(),
    },
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import {
  canViewDonors,
  canViewDonorAmounts,
  canViewVolunteers,
  canManageFollowUps,
} from '@/lib/permissions';
import { getAllDonorsForExport } from '@/lib/donors';
import { getAllOutreachLogsForExport } from '@/lib/outreach';

import { GET as donorExportGET } from '@/app/api/donors/export/route';
import { GET as volunteerExportGET } from '@/app/api/volunteers/export/route';
import { GET as outreachExportGET } from '@/app/api/outreach/export-history/route';

// ── Helpers ────────────────────────────────────────────────────────────────────

const SESSION_USER_ID = 'user-revocation-test';
const SESSION_CAMPAIGN_ID = 'campaign-1';

/** Return a valid-looking session for a campaign_manager (passes all permission checks). */
function mockValidSession(campaignId = SESSION_CAMPAIGN_ID) {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: {
      id: SESSION_USER_ID,
      activeCampaignId: campaignId,
      activeRole: 'campaign_manager',
    },
  });
}

/** Allow every permission check to pass so we reach the membership query. */
function allowAllPermissions() {
  (canViewDonors as jest.Mock).mockReturnValue(true);
  (canViewDonorAmounts as jest.Mock).mockReturnValue(true);
  (canViewVolunteers as jest.Mock).mockReturnValue(true);
  (canManageFollowUps as jest.Mock).mockReturnValue(true);
}

// ── /api/donors/export ────────────────────────────────────────────────────────

describe('GET /api/donors/export — membership revocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowAllPermissions();
    // Provide an empty donor list so CSV generation succeeds on the 200 path
    (getAllDonorsForExport as jest.Mock).mockResolvedValue([]);
  });

  test('case 1 — active membership (deletedAt: null) → 200', async () => {
    mockValidSession();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue({ id: 'mem-active' });

    const response = await donorExportGET();
    expect(response.status).toBe(200);
  });

  test('case 2 — no membership record at all → 403', async () => {
    mockValidSession();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await donorExportGET();
    expect(response.status).toBe(403);
  });

  test('case 3 — membership soft-deleted (deletedAt not null) → 403', async () => {
    // The route uses `where: { deletedAt: null }` — a soft-deleted membership
    // will NOT match that clause, so Prisma returns null. We simulate that here.
    mockValidSession();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await donorExportGET();
    expect(response.status).toBe(403);

    // Extra assertion: confirm the route DID query with deletedAt: null
    const call = (db.campaignMembership.findFirst as jest.Mock).mock.calls[0][0];
    expect(call.where).toMatchObject({
      userId: SESSION_USER_ID,
      campaignId: SESSION_CAMPAIGN_ID,
      deletedAt: null,
    });
  });

  test('case 4 — membership for a different campaignId → 403', async () => {
    // Session says campaign-1; membership only exists for campaign-99.
    // The route queries where campaignId = session.activeCampaignId (campaign-1),
    // so findFirst correctly returns null — access denied.
    mockValidSession('campaign-1');
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await donorExportGET();
    expect(response.status).toBe(403);
  });
});

// ── /api/volunteers/export ────────────────────────────────────────────────────

describe('GET /api/volunteers/export — membership revocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowAllPermissions();
    // Provide empty results so CSV generation succeeds on the 200 path
    (db.canvassResponse.findMany as jest.Mock).mockResolvedValue([]);
  });

  test('case 1 — active membership (deletedAt: null) → 200', async () => {
    mockValidSession();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue({ id: 'mem-active' });

    const response = await volunteerExportGET();
    expect(response.status).toBe(200);
  });

  test('case 2 — no membership record at all → 403', async () => {
    mockValidSession();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await volunteerExportGET();
    expect(response.status).toBe(403);
  });

  test('case 3 — membership soft-deleted (deletedAt not null) → 403', async () => {
    mockValidSession();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await volunteerExportGET();
    expect(response.status).toBe(403);

    const call = (db.campaignMembership.findFirst as jest.Mock).mock.calls[0][0];
    expect(call.where).toMatchObject({
      userId: SESSION_USER_ID,
      campaignId: SESSION_CAMPAIGN_ID,
      deletedAt: null,
    });
  });

  test('case 4 — membership for a different campaignId → 403', async () => {
    mockValidSession('campaign-1');
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await volunteerExportGET();
    expect(response.status).toBe(403);
  });
});

// ── /api/outreach/export-history ──────────────────────────────────────────────

describe('GET /api/outreach/export-history — membership revocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowAllPermissions();
    // Provide empty outreach logs so CSV generation succeeds on the 200 path
    (getAllOutreachLogsForExport as jest.Mock).mockResolvedValue([]);
  });

  test('case 1 — active membership (deletedAt: null) → 200', async () => {
    mockValidSession();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue({ id: 'mem-active' });

    const response = await outreachExportGET();
    expect(response.status).toBe(200);
  });

  test('case 2 — no membership record at all → 403', async () => {
    mockValidSession();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await outreachExportGET();
    expect(response.status).toBe(403);
  });

  test('case 3 — membership soft-deleted (deletedAt not null) → 403', async () => {
    mockValidSession();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await outreachExportGET();
    expect(response.status).toBe(403);

    const call = (db.campaignMembership.findFirst as jest.Mock).mock.calls[0][0];
    expect(call.where).toMatchObject({
      userId: SESSION_USER_ID,
      campaignId: SESSION_CAMPAIGN_ID,
      deletedAt: null,
    });
  });

  test('case 4 — membership for a different campaignId → 403', async () => {
    mockValidSession('campaign-1');
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await outreachExportGET();
    expect(response.status).toBe(403);
  });
});
