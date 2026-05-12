/**
 * Test 5 — Export Routes Re-verify Campaign Membership (Item 40)
 *
 * Tests that all 3 export route handlers (donors, volunteers, outreach)
 * re-verify campaign membership before returning data:
 *
 * - Returns 200 when user has active (non-deleted) membership for the campaign
 * - Returns 403 when user has no membership at all
 * - Returns 403 when membership has a non-null deletedAt (soft-deleted)
 *
 * Each of the 3 export routes is tested with the same 3 membership cases.
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

// Mock lib/donors to avoid hitting the DB
jest.mock('@/lib/donors', () => ({
  getAllDonorsForExport: jest.fn(),
}));

// Mock lib/outreach to avoid hitting the DB
jest.mock('@/lib/outreach', () => ({
  getAllOutreachLogsForExport: jest.fn(),
}));

// Mock audit logging
jest.mock('@/lib/audit', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

// Mock plan-limits — donor export calls isDonorTrackingEnabled which hits the DB
jest.mock('@/lib/plan-limits', () => ({
  isDonorTrackingEnabled: jest.fn().mockResolvedValue(true),
  getEffectiveLimits: jest.fn().mockResolvedValue({ donorTrackingEnabled: true }),
}));

jest.mock('@/lib/db', () => ({
  db: {
    campaignMembership: {
      findFirst: jest.fn(),
    },
    canvassResponse: {
      findMany: jest.fn(),
    },
    donor: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

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

// We import the GET handlers directly
import { GET as donorExportGET } from '@/app/api/donors/export/route';
import { GET as volunteerExportGET } from '@/app/api/volunteers/export/route';
import { GET as outreachExportGET } from '@/app/api/outreach/export-history/route';

// ── Helper: build a mock session ──────────────────────────────────────────────

function mockSessionForExport(options: {
  activeCampaignId?: string | null;
  activeRole?: string | null;
} = {}) {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: {
      id: 'user-1',
      activeCampaignId: options.activeCampaignId ?? 'campaign-1',
      activeRole: options.activeRole ?? 'campaign_manager',
    },
  });
}

function allowAllPermissions() {
  (canViewDonors as jest.Mock).mockReturnValue(true);
  (canViewDonorAmounts as jest.Mock).mockReturnValue(true);
  (canViewVolunteers as jest.Mock).mockReturnValue(true);
  (canManageFollowUps as jest.Mock).mockReturnValue(true);
}

// ── Donor export tests ────────────────────────────────────────────────────────

describe('GET /api/donors/export — membership re-verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowAllPermissions();
    (getAllDonorsForExport as jest.Mock).mockResolvedValue([]);
  });

  test('200 when user has active (non-deleted) membership', async () => {
    mockSessionForExport();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue({ id: 'membership-1' });

    const response = await donorExportGET();
    expect(response.status).toBe(200);
  });

  test('403 when user has no membership record at all', async () => {
    mockSessionForExport();
    // findFirst returns null — no matching active membership
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await donorExportGET();
    expect(response.status).toBe(403);
  });

  test('403 when membership has non-null deletedAt (soft-deleted)', async () => {
    mockSessionForExport();
    // The query includes deletedAt: null in the where clause — so a soft-deleted
    // membership will return null from findFirst, resulting in 403.
    // We simulate that by returning null (same as "not found").
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await donorExportGET();
    expect(response.status).toBe(403);
  });

  test('membership query MUST filter by deletedAt: null', async () => {
    mockSessionForExport();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue({ id: 'membership-1' });
    (getAllDonorsForExport as jest.Mock).mockResolvedValue([]);

    await donorExportGET();

    const membershipQuery = (db.campaignMembership.findFirst as jest.Mock).mock.calls[0][0];
    expect(membershipQuery.where).toMatchObject({
      userId: 'user-1',
      campaignId: 'campaign-1',
      deletedAt: null,
    });
  });

  test('401 when no session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await donorExportGET();
    expect(response.status).toBe(401);
  });

  test('403 when role lacks canViewDonors permission', async () => {
    mockSessionForExport();
    (canViewDonors as jest.Mock).mockReturnValue(false);

    const response = await donorExportGET();
    expect(response.status).toBe(403);
  });
});

// ── Volunteer export tests ────────────────────────────────────────────────────

describe('GET /api/volunteers/export — membership re-verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowAllPermissions();
    (db.canvassResponse.findMany as jest.Mock).mockResolvedValue([]);
  });

  test('200 when user has active membership', async () => {
    mockSessionForExport();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue({ id: 'membership-1' });

    const response = await volunteerExportGET();
    expect(response.status).toBe(200);
  });

  test('403 when user has no membership', async () => {
    mockSessionForExport();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await volunteerExportGET();
    expect(response.status).toBe(403);
  });

  test('403 when membership is soft-deleted (findFirst returns null)', async () => {
    mockSessionForExport();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await volunteerExportGET();
    expect(response.status).toBe(403);
  });

  test('membership query MUST filter by deletedAt: null', async () => {
    mockSessionForExport();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue({ id: 'membership-1' });
    (db.canvassResponse.findMany as jest.Mock).mockResolvedValue([]);

    await volunteerExportGET();

    const membershipQuery = (db.campaignMembership.findFirst as jest.Mock).mock.calls[0][0];
    expect(membershipQuery.where).toMatchObject({
      userId: 'user-1',
      campaignId: 'campaign-1',
      deletedAt: null,
    });
  });

  test('401 when no session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await volunteerExportGET();
    expect(response.status).toBe(401);
  });
});

// ── Outreach export tests ─────────────────────────────────────────────────────

describe('GET /api/outreach/export-history — membership re-verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowAllPermissions();
    (getAllOutreachLogsForExport as jest.Mock).mockResolvedValue([]);
  });

  test('200 when user has active membership', async () => {
    mockSessionForExport();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue({ id: 'membership-1' });

    const response = await outreachExportGET();
    expect(response.status).toBe(200);
  });

  test('403 when user has no membership', async () => {
    mockSessionForExport();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await outreachExportGET();
    expect(response.status).toBe(403);
  });

  test('403 when membership is soft-deleted (findFirst returns null)', async () => {
    mockSessionForExport();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await outreachExportGET();
    expect(response.status).toBe(403);
  });

  test('membership query MUST filter by deletedAt: null', async () => {
    mockSessionForExport();
    (db.campaignMembership.findFirst as jest.Mock).mockResolvedValue({ id: 'membership-1' });
    (getAllOutreachLogsForExport as jest.Mock).mockResolvedValue([]);

    await outreachExportGET();

    const membershipQuery = (db.campaignMembership.findFirst as jest.Mock).mock.calls[0][0];
    expect(membershipQuery.where).toMatchObject({
      userId: 'user-1',
      campaignId: 'campaign-1',
      deletedAt: null,
    });
  });

  test('401 when no session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await outreachExportGET();
    expect(response.status).toBe(401);
  });

  test('403 when role lacks canManageFollowUps permission', async () => {
    mockSessionForExport();
    (canManageFollowUps as jest.Mock).mockReturnValue(false);

    const response = await outreachExportGET();
    expect(response.status).toBe(403);
  });
});
