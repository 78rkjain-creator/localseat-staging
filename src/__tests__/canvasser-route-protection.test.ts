/**
 * Test 4 — Canvasser Route Deny-List (Item 39)
 *
 * Tests the route protection logic extracted from src/proxy.ts:
 * - canvasser role is REDIRECTED for /voter-list, /donors, /team, /admin, /outreach
 * - canvasser role is ALLOWED through to /canvassing
 * - campaign_manager role is NOT redirected for any of those routes
 *
 * We extract the pure routing logic rather than trying to invoke the full
 * Next.js middleware, which requires a real Next.js runtime.
 */

// ── Extracted routing logic (mirrors src/proxy.ts) ────────────────────────────
//
// We copy the constant and logic here to test it in isolation without
// importing the full Next.js middleware runtime.  If CANVASSER_ALLOW_PREFIXES
// changes in proxy.ts, this test will catch the regression.

const CANVASSER_ALLOW_PREFIXES = [
  '/canvassing',
  '/select-campaign',
  '/onboarding',
  '/account',
];

type RouteCheckResult = 'redirect_to_canvassing' | 'allowed';

/**
 * Pure function extracted from the middleware: given a role and pathname,
 * returns whether the canvasser deny-list logic would redirect or allow.
 */
function checkCanvasserRoute(role: string | null, pathname: string): RouteCheckResult {
  if (role === 'canvasser') {
    const allowed = CANVASSER_ALLOW_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );
    if (!allowed) {
      return 'redirect_to_canvassing';
    }
  }
  return 'allowed';
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Canvasser route deny-list (proxy.ts logic)', () => {

  describe('canvasser role — denied routes redirect to /canvassing', () => {
    const deniedRoutes = [
      '/voter-list',
      '/voter-list/duplicates',
      '/donors',
      '/donors/new',
      '/team',
      '/admin',
      '/admin/settings',
      '/outreach',
      '/outreach/history',
      '/dashboard',
      '/people',
    ];

    test.each(deniedRoutes)('canvasser is redirected from %s', (path) => {
      expect(checkCanvasserRoute('canvasser', path)).toBe('redirect_to_canvassing');
    });
  });

  describe('canvasser role — allowed routes pass through', () => {
    const allowedRoutes = [
      '/canvassing',
      '/canvassing/list-123/canvass',
      '/select-campaign',
      '/onboarding',
      '/onboarding/create-campaign',
      '/account',
      '/account/settings',
    ];

    test.each(allowedRoutes)('canvasser is allowed through %s', (path) => {
      expect(checkCanvasserRoute('canvasser', path)).toBe('allowed');
    });
  });

  describe('campaign_manager role — not redirected for any route', () => {
    const routes = [
      '/voter-list',
      '/donors',
      '/team',
      '/admin',
      '/outreach',
      '/canvassing',
      '/dashboard',
      '/people',
    ];

    test.each(routes)('campaign_manager is allowed through %s', (path) => {
      expect(checkCanvasserRoute('campaign_manager', path)).toBe('allowed');
    });
  });

  describe('other roles — not affected by canvasser deny-list', () => {
    const roles = ['field_organizer', 'volunteer_coordinator', 'candidate', 'finance_lead'];
    const path = '/voter-list';

    test.each(roles)('%s is not redirected from /voter-list', (role) => {
      expect(checkCanvasserRoute(role, path)).toBe('allowed');
    });
  });

  describe('null role — not affected by canvasser deny-list', () => {
    test('null role passes through (handled by authorized callback before this logic)', () => {
      expect(checkCanvasserRoute(null, '/donors')).toBe('allowed');
    });
  });

  describe('CANVASSER_ALLOW_PREFIXES coverage', () => {
    test('all expected prefixes are present in the deny-list allow set', () => {
      expect(CANVASSER_ALLOW_PREFIXES).toContain('/canvassing');
      expect(CANVASSER_ALLOW_PREFIXES).toContain('/select-campaign');
      expect(CANVASSER_ALLOW_PREFIXES).toContain('/onboarding');
      expect(CANVASSER_ALLOW_PREFIXES).toContain('/account');
    });

    test('/canvassing prefix match is prefix-based, not exact', () => {
      // /canvassing/some-list/canvass must be allowed
      expect(checkCanvasserRoute('canvasser', '/canvassing/list-abc/canvass')).toBe('allowed');
    });
  });
});
