/**
 * Test 1 — Canvass Response Deduplication (Item 29)
 *
 * Tests the upsert behavior in saveCanvassResponse:
 * - Saving the same assignmentId + personId twice should not create two records
 * - Second save updates the existing record
 * - Third save with a different supportLevel updates to the new level
 *
 * Uses mocked Prisma client and mocked next-auth session.
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock revalidatePath to avoid Next.js internals
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock audit logging — not the subject under test
jest.mock('@/lib/audit', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

// Mock the db module
jest.mock('@/lib/db', () => ({
  db: {
    canvassAssignment: { findFirst: jest.fn() },
    person: { findFirst: jest.fn() },
    canvassResponse: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    outreachLog: { create: jest.fn() },
    volunteerRecord: { upsert: jest.fn() },
    donor: { findFirst: jest.fn(), create: jest.fn() },
    task: { create: jest.fn() },
  },
}));

import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { saveCanvassResponse } from '@/app/(app)/canvassing/[listId]/canvass/actions';

// ── Helpers ────────────────────────────────────────────────────────────────────

const mockSession = {
  user: {
    id: 'user-1',
    firstName: 'Jane',
    lastName: 'Smith',
    activeCampaignId: 'campaign-1',
  },
};

const baseInput = {
  assignmentId: 'assignment-1',
  personId: 'person-1',
  outcome: 'contacted' as const,
  supportLevel: 'strong_yes' as const,
  signRequest: false,
  volunteerInterest: false,
  donorInterest: false,
  notes: '',
  needsFollowUp: false,
};

function setupMocksForFirstSave() {
  (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  (db.canvassAssignment.findFirst as jest.Mock).mockResolvedValue({ id: 'assignment-1' });
  (db.person.findFirst as jest.Mock).mockResolvedValue({
    id: 'person-1',
    firstName: 'John',
    lastName: 'Doe',
  });
  // No existing response — first save
  (db.canvassResponse.findUnique as jest.Mock).mockResolvedValue(null);
  (db.canvassResponse.upsert as jest.Mock).mockResolvedValue({ id: 'response-abc' });
  (db.outreachLog.create as jest.Mock).mockResolvedValue(undefined);
}

function setupMocksForSubsequentSave(existingResponseId: string) {
  (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  (db.canvassAssignment.findFirst as jest.Mock).mockResolvedValue({ id: 'assignment-1' });
  (db.person.findFirst as jest.Mock).mockResolvedValue({
    id: 'person-1',
    firstName: 'John',
    lastName: 'Doe',
  });
  // Existing response present — retry/duplicate
  (db.canvassResponse.findUnique as jest.Mock).mockResolvedValue({ id: existingResponseId });
  (db.canvassResponse.upsert as jest.Mock).mockResolvedValue({ id: existingResponseId });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('saveCanvassResponse — deduplication (upsert behavior)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('first save: upsert is called with create + update data', async () => {
    setupMocksForFirstSave();

    const result = await saveCanvassResponse(baseInput);

    expect(result.error).toBeUndefined();
    expect(result.responseId).toBe('response-abc');

    // Upsert MUST have been called exactly once
    expect(db.canvassResponse.upsert).toHaveBeenCalledTimes(1);

    const upsertCall = (db.canvassResponse.upsert as jest.Mock).mock.calls[0][0];

    // The unique constraint key must be used
    expect(upsertCall.where).toEqual({
      assignmentId_personId: { assignmentId: 'assignment-1', personId: 'person-1' },
    });

    // Create payload must include both FK fields
    expect(upsertCall.create).toMatchObject({
      assignmentId: 'assignment-1',
      personId: 'person-1',
      outcome: 'contacted',
      supportLevel: 'strong_yes',
    });

    // Update payload must NOT include FK fields (would fail Prisma)
    expect(upsertCall.update).not.toHaveProperty('assignmentId');
    expect(upsertCall.update).not.toHaveProperty('personId');
    expect(upsertCall.update).toMatchObject({ outcome: 'contacted', supportLevel: 'strong_yes' });
  });

  test('second save (retry): upsert still called, but side effects (outreach log, tasks) are skipped', async () => {
    setupMocksForSubsequentSave('response-abc');

    const result = await saveCanvassResponse(baseInput);

    expect(result.error).toBeUndefined();
    expect(result.responseId).toBe('response-abc');

    // Upsert still fires (idempotent update)
    expect(db.canvassResponse.upsert).toHaveBeenCalledTimes(1);

    // Side effects must NOT fire on a duplicate submission
    expect(db.outreachLog.create).not.toHaveBeenCalled();
    expect(db.task.create).not.toHaveBeenCalled();
    expect(db.volunteerRecord.upsert).not.toHaveBeenCalled();
    expect(db.donor.create).not.toHaveBeenCalled();
  });

  test('third save with different support level updates the record to the new level', async () => {
    // Second call — existing response already exists
    setupMocksForSubsequentSave('response-abc');

    const updatedInput = { ...baseInput, supportLevel: 'soft_no' as const };
    const result = await saveCanvassResponse(updatedInput);

    expect(result.error).toBeUndefined();
    expect(db.canvassResponse.upsert).toHaveBeenCalledTimes(1);

    const upsertCall = (db.canvassResponse.upsert as jest.Mock).mock.calls[0][0];

    // The update data must carry the new support level
    expect(upsertCall.update).toMatchObject({ supportLevel: 'soft_no' });
  });

  test('first save triggers outreach log creation', async () => {
    setupMocksForFirstSave();

    await saveCanvassResponse(baseInput);

    // First-save path should auto-create an outreach log entry
    expect(db.outreachLog.create).toHaveBeenCalledTimes(1);
    const logCall = (db.outreachLog.create as jest.Mock).mock.calls[0][0];
    expect(logCall.data).toMatchObject({
      campaignId: 'campaign-1',
      personId: 'person-1',
      channel: 'door_knock',
    });
  });

  test('returns error when session is missing', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const result = await saveCanvassResponse(baseInput);
    expect(result.error).toBe('Not authenticated.');
    expect(db.canvassResponse.upsert).not.toHaveBeenCalled();
  });

  test('returns error when assignment does not belong to canvasser', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (db.canvassAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await saveCanvassResponse(baseInput);
    expect(result.error).toBe('Assignment not found.');
    expect(db.canvassResponse.upsert).not.toHaveBeenCalled();
  });
});
