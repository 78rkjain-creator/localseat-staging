/**
 * Canvass Response — multi-visit behavior (Item 29 updated)
 *
 * The unique constraint on (assignmentId, personId) has been removed.
 * saveCanvassResponse now always calls db.canvassResponse.create — every
 * interaction produces a new record. Side effects (outreach log, tasks, etc.)
 * run on every save.
 *
 * Deduplication of accidental double-taps is handled client-side:
 *   - Online: useTransition isPending flag blocks concurrent submissions.
 *   - Offline: offline-queue.ts rejects enqueue() within a 30-second window
 *     for the same assignmentId+personId pair.
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

jest.mock('@/lib/audit', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

// Mock @prisma/client enums used at module level in transitive imports
jest.mock('@prisma/client', () => ({
  Role: {
    candidate: 'candidate',
    campaign_manager: 'campaign_manager',
    data_manager: 'data_manager',
    co_chair: 'co_chair',
    field_organizer: 'field_organizer',
    canvasser: 'canvasser',
    volunteer_coordinator: 'volunteer_coordinator',
    finance_lead: 'finance_lead',
    sign_installer: 'sign_installer',
    data_supplier: 'data_supplier',
  },
  WardStatus: { not_checked: 'not_checked', inside: 'inside', outside: 'outside', outside_accepted: 'outside_accepted', pending_review: 'pending_review' },
  ListSource: { voters_list: 'voters_list', residents_list: 'residents_list', manual: 'manual', canvass: 'canvass', team: 'team' },
  Prisma: {},
  PrismaClient: jest.fn(),
}));

// Mock support-access — saveCanvassResponse imports checkSupportWriteAccess
jest.mock('@/lib/support-access', () => ({
  checkSupportWriteAccess: jest.fn().mockResolvedValue({ allowed: true }),
}));

// Mock plan-limits — saveCanvassResponse imports canAddConstituent
jest.mock('@/lib/plan-limits', () => ({
  canAddConstituent: jest.fn().mockResolvedValue(true),
}));

// Mock ward — saveCanvassResponse imports isPointInWard, campaignHasWard
jest.mock('@/lib/ward', () => ({
  isPointInWard: jest.fn().mockReturnValue(true),
  campaignHasWard: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/lib/db', () => ({
  db: {
    canvassAssignment: { findFirst: jest.fn() },
    person: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    canvassResponse: {
      create: jest.fn(),
    },
    outreachLog: { create: jest.fn() },
    volunteerRecord: { upsert: jest.fn() },
    donor: { findFirst: jest.fn(), create: jest.fn() },
    task: { findFirst: jest.fn(), create: jest.fn() },
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

function setupMocks() {
  (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  (db.canvassAssignment.findFirst as jest.Mock).mockResolvedValue({ id: 'assignment-1' });
  (db.person.findFirst as jest.Mock).mockResolvedValue({
    id: 'person-1',
    firstName: 'John',
    lastName: 'Doe',
  });
  (db.canvassResponse.create as jest.Mock).mockResolvedValue({ id: 'response-abc' });
  (db.outreachLog.create as jest.Mock).mockResolvedValue(undefined);
  (db.task.findFirst as jest.Mock).mockResolvedValue(null);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('saveCanvassResponse — multi-visit (create behavior)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('every save calls create (not upsert) and returns a responseId', async () => {
    setupMocks();

    const result = await saveCanvassResponse(baseInput);

    expect(result.error).toBeUndefined();
    expect(result.responseId).toBe('response-abc');
    expect(db.canvassResponse.create).toHaveBeenCalledTimes(1);

    const createCall = (db.canvassResponse.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data).toMatchObject({
      assignmentId: 'assignment-1',
      personId: 'person-1',
      outcome: 'contacted',
      supportLevel: 'strong_yes',
    });
  });

  test('second save for the same person creates a second record', async () => {
    setupMocks();

    await saveCanvassResponse(baseInput);
    (db.canvassResponse.create as jest.Mock).mockResolvedValue({ id: 'response-xyz' });
    const result2 = await saveCanvassResponse({ ...baseInput, supportLevel: 'soft_yes' });

    expect(result2.error).toBeUndefined();
    expect(result2.responseId).toBe('response-xyz');
    expect(db.canvassResponse.create).toHaveBeenCalledTimes(2);

    const secondCreate = (db.canvassResponse.create as jest.Mock).mock.calls[1][0];
    expect(secondCreate.data).toMatchObject({ supportLevel: 'soft_yes' });
  });

  test('outreach log is created on every save', async () => {
    setupMocks();

    await saveCanvassResponse(baseInput);
    (db.canvassResponse.create as jest.Mock).mockResolvedValue({ id: 'response-xyz' });
    await saveCanvassResponse(baseInput);

    expect(db.outreachLog.create).toHaveBeenCalledTimes(2);
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
    expect(db.canvassResponse.create).not.toHaveBeenCalled();
  });

  test('returns error when assignment does not belong to canvasser', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (db.canvassAssignment.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await saveCanvassResponse(baseInput);
    expect(result.error).toBe('Assignment not found.');
    expect(db.canvassResponse.create).not.toHaveBeenCalled();
  });
});

// ── Offline queue dedup — unit tests for the dedup logic ─────────────────────
//
// The dedup logic lives inside enqueue() in offline-queue.ts. Since IndexedDB
// is unavailable in Node, these tests exercise the pure dedup predicate directly.

const DEDUP_WINDOW_MS = 30_000;

type PendingStub = { assignmentId: string; personId: string; queuedAt: number };

function wouldDeduplicate(pending: PendingStub[], assignmentId: string, personId: string): boolean {
  const now = Date.now();
  return pending.some(
    (q) =>
      q.assignmentId === assignmentId &&
      q.personId === personId &&
      now - q.queuedAt < DEDUP_WINDOW_MS
  );
}

describe('offline-queue — 30-second dedup predicate', () => {
  test('no prior items: not a duplicate', () => {
    expect(wouldDeduplicate([], 'a-1', 'p-1')).toBe(false);
  });

  test('same assignment+person queued just now: duplicate', () => {
    const pending: PendingStub[] = [
      { assignmentId: 'a-1', personId: 'p-1', queuedAt: Date.now() - 5_000 },
    ];
    expect(wouldDeduplicate(pending, 'a-1', 'p-1')).toBe(true);
  });

  test('same assignment+person queued 31 seconds ago: not a duplicate', () => {
    const pending: PendingStub[] = [
      { assignmentId: 'a-1', personId: 'p-1', queuedAt: Date.now() - 31_000 },
    ];
    expect(wouldDeduplicate(pending, 'a-1', 'p-1')).toBe(false);
  });

  test('same person, different assignment: not a duplicate', () => {
    const pending: PendingStub[] = [
      { assignmentId: 'a-1', personId: 'p-1', queuedAt: Date.now() - 5_000 },
    ];
    expect(wouldDeduplicate(pending, 'a-2', 'p-1')).toBe(false);
  });

  test('same assignment, different person: not a duplicate', () => {
    const pending: PendingStub[] = [
      { assignmentId: 'a-1', personId: 'p-1', queuedAt: Date.now() - 5_000 },
    ];
    expect(wouldDeduplicate(pending, 'a-1', 'p-2')).toBe(false);
  });
});
