/**
 * Test 3 — Volunteer Shift Campaign Ownership (Item 37)
 *
 * Tests that assignVolunteerToShift enforces campaign ownership:
 * - Succeeds when volunteer record belongs to the same campaign as the shift
 * - Returns error when volunteer record belongs to a different campaign
 * - upsert is never called when the campaign ownership check fails
 *
 * The actual implementation queries volunteerRecord with { id, campaignId } —
 * a record from a different campaign will not be found, enforcing isolation.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/permissions', () => ({
  canViewVolunteers: jest.fn().mockReturnValue(true),
  isReadOnly: jest.fn().mockReturnValue(false),
}));

jest.mock('@/lib/sanitize', () => ({
  sanitizeDate: jest.fn((d: string) => new Date(d)),
  sanitizeInteger: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  db: {
    volunteerShift: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    volunteerRecord: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    volunteerShiftAttendee: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { assignVolunteerToShift } from '@/app/(app)/volunteers/schedule/actions';

// ── Helpers ────────────────────────────────────────────────────────────────────

const CAMPAIGN_A = 'campaign-a';
const CAMPAIGN_B = 'campaign-b';

function mockSession(campaignId: string) {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: {
      id: 'user-1',
      firstName: 'Jane',
      lastName: 'Smith',
      activeCampaignId: campaignId,
      activeRole: 'volunteer_coordinator',
    },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('assignVolunteerToShift — campaign ownership enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('succeeds when volunteer record belongs to the same campaign as the shift', async () => {
    mockSession(CAMPAIGN_A);

    // Shift found in campaign A
    (db.volunteerShift.findFirst as jest.Mock).mockResolvedValue({
      id: 'shift-1',
      maxVolunteers: 10,
      _count: { attendees: 2 },
    });

    // Volunteer record also belongs to campaign A
    (db.volunteerRecord.findFirst as jest.Mock).mockResolvedValue({ id: 'record-1' });
    (db.volunteerShiftAttendee.upsert as jest.Mock).mockResolvedValue({ id: 'attendee-1' });

    const result = await assignVolunteerToShift('shift-1', 'record-1');

    expect(result.error).toBeUndefined();
    expect(db.volunteerShiftAttendee.upsert).toHaveBeenCalledTimes(1);
  });

  test('returns error when volunteer record belongs to a different campaign', async () => {
    mockSession(CAMPAIGN_A);

    // Shift found in campaign A (session campaign)
    (db.volunteerShift.findFirst as jest.Mock).mockResolvedValue({
      id: 'shift-1',
      maxVolunteers: 10,
      _count: { attendees: 2 },
    });

    // Volunteer record query scoped to CAMPAIGN_A returns null
    // because record belongs to CAMPAIGN_B
    (db.volunteerRecord.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await assignVolunteerToShift('shift-1', 'record-from-campaign-b');

    expect(result.error).toBe('Volunteer record not found.');
    expect(db.volunteerShiftAttendee.upsert).not.toHaveBeenCalled();
  });

  test('upsert is never called when ownership check fails', async () => {
    mockSession(CAMPAIGN_A);

    (db.volunteerShift.findFirst as jest.Mock).mockResolvedValue({
      id: 'shift-1',
      maxVolunteers: null,
      _count: { attendees: 0 },
    });

    // Simulate cross-campaign record (returns null for campaignId = CAMPAIGN_A)
    (db.volunteerRecord.findFirst as jest.Mock).mockResolvedValue(null);

    await assignVolunteerToShift('shift-1', 'foreign-record');

    expect(db.volunteerShiftAttendee.upsert).toHaveBeenCalledTimes(0);
  });

  test('volunteerRecord.findFirst is called with the session campaignId', async () => {
    mockSession(CAMPAIGN_A);

    (db.volunteerShift.findFirst as jest.Mock).mockResolvedValue({
      id: 'shift-1',
      maxVolunteers: null,
      _count: { attendees: 0 },
    });

    (db.volunteerRecord.findFirst as jest.Mock).mockResolvedValue({ id: 'record-1' });
    (db.volunteerShiftAttendee.upsert as jest.Mock).mockResolvedValue({});

    await assignVolunteerToShift('shift-1', 'record-1');

    // The ownership check must pass campaignId from the session
    const recordQuery = (db.volunteerRecord.findFirst as jest.Mock).mock.calls[0][0];
    expect(recordQuery.where).toMatchObject({
      id: 'record-1',
      campaignId: CAMPAIGN_A,
    });
  });

  test('returns error when shift is not found in the session campaign', async () => {
    mockSession(CAMPAIGN_A);

    // Shift not found (could belong to another campaign)
    (db.volunteerShift.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await assignVolunteerToShift('shift-other', 'record-1');

    expect(result.error).toBe('Shift not found.');
    expect(db.volunteerRecord.findFirst).not.toHaveBeenCalled();
    expect(db.volunteerShiftAttendee.upsert).not.toHaveBeenCalled();
  });

  test('returns error when shift is at capacity', async () => {
    mockSession(CAMPAIGN_A);

    (db.volunteerShift.findFirst as jest.Mock).mockResolvedValue({
      id: 'shift-1',
      maxVolunteers: 5,
      _count: { attendees: 5 }, // at capacity
    });

    (db.volunteerRecord.findFirst as jest.Mock).mockResolvedValue({ id: 'record-1' });

    const result = await assignVolunteerToShift('shift-1', 'record-1');

    expect(result.error).toBe('This shift is already at capacity.');
    expect(db.volunteerShiftAttendee.upsert).not.toHaveBeenCalled();
  });

  test('returns error when not authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const result = await assignVolunteerToShift('shift-1', 'record-1');

    expect(result.error).toBe('Not authenticated.');
    expect(db.volunteerShift.findFirst).not.toHaveBeenCalled();
    expect(db.volunteerShiftAttendee.upsert).not.toHaveBeenCalled();
  });
});
