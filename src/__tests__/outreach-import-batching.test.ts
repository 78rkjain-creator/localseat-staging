/**
 * Test 2 — Outreach CSV Import Batched Queries (Item 34)
 *
 * Tests that importOutreachResults uses batch lookups rather than N+1 queries:
 * - Exactly 1 db.person.findMany for phones (OR across all unique phones)
 * - Exactly 1 db.person.findMany for names (OR across all unique names)
 * - db.outreachLog.createMany called once for all matched rows
 * - No db.person.findFirst calls inside a per-row loop
 * - Query count stays constant regardless of input size (tested with 100 rows)
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
  canManageFollowUps: jest.fn().mockReturnValue(true),
}));

jest.mock('@/lib/db', () => ({
  db: {
    person: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    outreachLog: {
      createMany: jest.fn(),
    },
  },
}));

import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { importOutreachResults } from '@/app/(app)/outreach/actions';
import type { ImportedOutreachRow } from '@/app/(app)/outreach/actions';

// ── Helpers ────────────────────────────────────────────────────────────────────

const mockSession = {
  user: {
    id: 'user-1',
    firstName: 'Jane',
    lastName: 'Doe',
    activeCampaignId: 'campaign-1',
    activeRole: 'campaign_manager',
  },
};

/** Generate N import rows, each with a unique phone and name */
function generateRows(count: number): ImportedOutreachRow[] {
  return Array.from({ length: count }, (_, i) => ({
    firstName: `First${i}`,
    lastName: `Last${i}`,
    address: `${i} Test St`,
    phone: `416555${String(i).padStart(4, '0')}`,
    channel: 'phone_call' as const,
    date: '2026-04-15',
    outcome: 'Contacted',
  }));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('importOutreachResults — batch queries (no N+1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
    (db.outreachLog.createMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  test('with 5 rows: exactly 2 person.findMany calls (phones + names) + 1 createMany', async () => {
    const rows = generateRows(5);

    // Return matching person for each phone
    (db.person.findMany as jest.Mock)
      .mockResolvedValueOnce(
        rows.map((r, i) => ({
          id: `person-${i}`,
          phoneHome: r.phone,
          phoneMobile: null,
        }))
      )
      // No name-match candidates needed (all matched by phone)
      .mockResolvedValueOnce([]);

    await importOutreachResults(rows);

    // Must be exactly 2 findMany calls — one for phones, one for names
    expect(db.person.findMany).toHaveBeenCalledTimes(2);

    // Must NOT use findFirst — that would be an N+1 pattern
    expect(db.person.findFirst).not.toHaveBeenCalled();

    // createMany called exactly once for all rows
    expect(db.outreachLog.createMany).toHaveBeenCalledTimes(1);
    const createManyCall = (db.outreachLog.createMany as jest.Mock).mock.calls[0][0];
    expect(createManyCall.data).toHaveLength(5);
  });

  test('with 100 rows: query count stays at exactly 2 lookups + 1 createMany', async () => {
    const rows = generateRows(100);

    (db.person.findMany as jest.Mock)
      .mockResolvedValueOnce(
        rows.map((r, i) => ({
          id: `person-${i}`,
          phoneHome: r.phone,
          phoneMobile: null,
        }))
      )
      .mockResolvedValueOnce([]);

    await importOutreachResults(rows);

    // KEY ASSERTION: query count must NOT scale with input size
    expect(db.person.findMany).toHaveBeenCalledTimes(2);
    expect(db.person.findFirst).not.toHaveBeenCalled();
    expect(db.outreachLog.createMany).toHaveBeenCalledTimes(1);

    const createManyCall = (db.outreachLog.createMany as jest.Mock).mock.calls[0][0];
    expect(createManyCall.data).toHaveLength(100);
  });

  test('rows without phones are matched by name via a single findMany (phone query skipped)', async () => {
    // These rows have NO phone field — so uniquePhones is empty and the
    // phone findMany is skipped entirely.  Only the name findMany fires.
    const rows: ImportedOutreachRow[] = [
      { firstName: 'Alice', lastName: 'Wong', address: '1 Main St', channel: 'phone_call', date: '2026-04-15' },
      { firstName: 'Bob', lastName: 'Singh', address: '2 Elm St', channel: 'phone_call', date: '2026-04-15' },
    ];

    // Only ONE findMany fires (name query) because uniquePhones.length === 0
    (db.person.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'person-alice', firstName: 'Alice', lastName: 'Wong' },
      { id: 'person-bob', firstName: 'Bob', lastName: 'Singh' },
    ]);

    const result = await importOutreachResults(rows);

    expect(result.unmatched).toHaveLength(0);
    // Only 1 findMany call total (name lookup; phone lookup is skipped)
    expect(db.person.findMany).toHaveBeenCalledTimes(1);
    expect(db.outreachLog.createMany).toHaveBeenCalledTimes(1);
    const data = (db.outreachLog.createMany as jest.Mock).mock.calls[0][0].data;
    expect(data).toHaveLength(2);
  });

  test('unmatched rows are returned without error, matched rows are still inserted', async () => {
    // row[0] has a phone — phone findMany fires first, matches row[0]
    // row[1] has no phone but has a name — name findMany fires second, no match found
    const rows: ImportedOutreachRow[] = [
      { firstName: 'Known', lastName: 'Person', address: '1 Main St', phone: '4165551111', channel: 'phone_call', date: '2026-04-15' },
      { firstName: 'Unknown', lastName: 'Ghost', address: '99 Nowhere', channel: 'phone_call', date: '2026-04-15' },
    ];

    (db.person.findMany as jest.Mock)
      // Call 1: phone lookup — returns the known person matched by phone
      .mockResolvedValueOnce([
        { id: 'person-known', phoneHome: '4165551111', phoneMobile: null },
      ])
      // Call 2: name lookup — returns empty (Unknown Ghost has no DB record)
      .mockResolvedValueOnce([]);

    const result = await importOutreachResults(rows);

    expect(result.imported).toBe(1);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].firstName).toBe('Unknown');
    // Exactly 2 findMany calls: one phone, one name
    expect(db.person.findMany).toHaveBeenCalledTimes(2);
    expect(db.outreachLog.createMany).toHaveBeenCalledTimes(1);
  });

  test('returns error when session is missing', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const result = await importOutreachResults(generateRows(5));
    expect(result.error).toBeDefined();
    expect(db.person.findMany).not.toHaveBeenCalled();
    expect(db.outreachLog.createMany).not.toHaveBeenCalled();
  });

  test('returns error for empty rows array', async () => {
    const result = await importOutreachResults([]);
    expect(result.error).toBeDefined();
    expect(db.outreachLog.createMany).not.toHaveBeenCalled();
  });
});
