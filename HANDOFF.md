# LocalSeat.io — Handoff Notes

## How I Work

- Provide prompts for VS Code Claude plugin — not raw source code
- Read existing files only when information is not already known from context
- Run commands one at a time — PowerShell does not support &&
- Never run audit-only prompts when answer can be inferred from context

---

## What This Is

A lightweight Canada-focused municipal campaign CRM and canvassing platform. Built with Next.js, TypeScript, Tailwind CSS, PostgreSQL, and Prisma. Production on Hostinger VPS.

---

## Tech Stack

- **Frontend/Backend:** Next.js 16 with TypeScript and Tailwind CSS
- **Database:** PostgreSQL with Prisma ORM (v5 — do not upgrade)
- **Auth:** NextAuth.js v4 with credentials provider
- **Email:** Nodemailer via Hostinger SMTP
- **SMS:** Telnyx (decided, not yet built)
- **Payments:** Stripe (decided, not yet built)
- **Production:** Hostinger VPS (app.localseat.io)
- **Demo:** Hostinger VPS (demo.localseat.io)
- **Staging:** Vercel + Neon PostgreSQL (localseat-staging.vercel.app)
- **Local dev:** Windows, VS Code, Node v24

---

## Repository and URLs

- **GitHub production:** git@github.com:78rkjain-creator/localseat.io.git
- **GitHub staging:** https://github.com/78rkjain-creator/localseat-staging.git
- **Local path:** C:\Users\rkjai\OneDrive\Desktop\localseat.io
- **Production:** https://app.localseat.io
- **Demo:** https://demo.localseat.io
- **Staging:** https://localseat-staging.vercel.app

---

## Infrastructure

- Hostinger VPS KVM2: IP 2.24.212.25, Ubuntu 24.04, 8GB RAM, 100GB NVMe
- Production app: /var/www/localseat, PM2 process `localseat`, port 3000
- Demo app: /var/www/demo, PM2 process `localseat-demo`, port 3001
- Deploy script: /var/www/localseat/deploy.sh
- nginx routing app.localseat.io → 3000, demo.localseat.io → 3001
- SSL via certbot for both domains, auto-renews
- Firewall: ports 22, 80, 443 open — port 5432 blocked
- Daily demo reset cron: 3am via crontab (`npx prisma db seed`)
- PostgreSQL on VPS: `localseat_prod` (production), `localseat_demo` (demo)
- Staging DB: Neon PostgreSQL (free tier)

---

## Deployment Workflow

1. All development work → `git push staging main`
2. Vercel auto-deploys staging on every push
3. **TEST on staging** (https://localseat-staging.vercel.app) before every production deploy
4. Only push to production after staging passes
5. `git push origin main` → SSH into VPS and run `cd /var/www/localseat && ./deploy.sh`
6. **Never push directly to production without testing on staging first**
7. Demo site pulls from localseat-staging repo — deploy with:

```
cd /var/www/demo
git pull origin main
npm run build
pm2 restart localseat-demo --update-env
```

---

## Local Development Commands

```
taskkill /F /IM node.exe
npm run dev
npx next dev -H 0.0.0.0
npx prisma generate
npx prisma migrate dev --name <migration-name>
npx prisma migrate reset --force
npx prisma db seed
npm run typecheck
```

---

## Environment Variables

### Local `.env`

```
DATABASE_URL="postgresql://postgres:!Kasliwal78!@localhost:5432/localseat_dev"
NEXTAUTH_SECRET="localseat-dev-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="info@localseat.io"
SMTP_PASS="<password>"
SMTP_FROM_WELCOME="hello@localseat.io"
SMTP_FROM_APPROVALS="approvals@localseat.io"
NEXT_PUBLIC_STRIPE_ENABLED="false"   # set to "true" when Stripe is wired
```

### Production VPS (`/var/www/localseat/.env`)

```
DATABASE_URL="postgresql://localseat:LS_Prod_2026x@localhost:5432/localseat_prod"
NEXTAUTH_SECRET="<generated secret>"
NEXTAUTH_URL="https://app.localseat.io"
DEMO_WEBHOOK_SECRET="localseat-demo-webhook-2026"
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM_WELCOME, SMTP_FROM_APPROVALS
NEXT_PUBLIC_STRIPE_ENABLED="false"   # set to "true" when Stripe is wired
```

### Demo VPS (`/var/www/demo/.env`)

```
DATABASE_URL="postgresql://demo:LS_Demo_2026x@localhost:5432/localseat_demo"
NEXTAUTH_SECRET="localseat-demo-secret-2026"
NEXTAUTH_URL="https://demo.localseat.io"
DEMO_MODE="true"
PRODUCTION_API_URL="https://app.localseat.io"
DEMO_WEBHOOK_SECRET="localseat-demo-webhook-2026"
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM_WELCOME, SMTP_FROM_APPROVALS
NEXT_PUBLIC_STRIPE_ENABLED="false"   # set to "true" when Stripe is wired
```

### Staging (Vercel)

```
DATABASE_URL="<Neon connection string>"
NEXTAUTH_SECRET="<staging secret>"
NEXTAUTH_URL="https://localseat-staging.vercel.app"
SMTP vars same as above
NEXT_PUBLIC_STRIPE_ENABLED="false"   # set to "true" when Stripe is wired
```

---

## Seed Users (all passwords: `password`)

| Email | Role | Name |
|---|---|---|
| superuser@localseat.io | super_user (platform) | Super User |
| demo@localseat.io | candidate (demo entry) | Demo Login |
| alex.chen@example.com | candidate | Alex Chen |
| maria.santos@example.com | campaign_manager | Maria Santos |
| claire.morgan@example.com | co_chair | Claire Morgan |
| robert.bell@example.com | co_chair | Robert Bell |
| james.okafor@example.com | field_organizer | James Okafor |
| sarah.kim@example.com | field_organizer | Sarah Kim |
| priya.nair@example.com | canvasser | Priya Nair |
| kevin.lafleur@example.com | canvasser | Kevin Lafleur |
| amy.zhang@example.com | canvasser | Amy Zhang |
| tom.okonkwo@example.com | canvasser | Tom Okonkwo |
| sara.bishop@example.com | volunteer_coordinator | Sara Bishop |
| dan.wu@example.com | finance_lead | Dan Wu |

After any reseed: sign out and back in to refresh JWT.

---

## Role Hierarchy

```
Candidate
  └── Campaign Manager
        └── Co-Chair
              └── Field Organizer
                    └── Canvasser
                    └── Volunteer Coordinator
                    └── Finance Lead
```

---

## Session Log — April 22, 2026 (UI Overhaul + Competitor Tracking)

**Commit: 0217167 — 34 files changed, 1,271 insertions**

### Bundle A — Token foundation + quick wins

- sentiment and ink color tokens added to `tailwind.config.ts`
- `.tabular` and `.display` utility classes added to `globals.css`
- Sidebar active nav pattern: `bg-slate-100 text-slate-900 font-semibold border-l-2 border-brand-500 rounded-r-xl`
- Active nav uses `rounded-r-xl` (not `rounded-xl`) so the left border sits flush
- Progress bar fills → `bg-slate-800` across all dashboard files
- Metric numbers → `text-slate-900 font-bold`
- Support rate → semantic color (emerald ≥50%, amber 30–49%, red <30%)
- Inline text links → `text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900`
- "More options" → "Other outcome" on canvass screen
- Touch targets already compliant at h-11/h-12

### Bundle B — Canvass screen rewrite

- Shared `ListRow` component at `src/components/ui/list-row.tsx`
- Household-first canvass screen — address as headline, not person name
- 1–5 sentiment scale with new sentiment tokens (emerald → amber → red)
- Resident queue showing co-residents with progress dots
- Interest chips (Sign / Volunteer / Donate) inline, visible for support levels 1–3
- Offline status pill replacing SyncStatusBar amber strip
- `SUPPORT_LEVELS` config array and `handleNotHome` kept as unused locals intentionally per spec (TS6133 hints only, not errors)

### Bundle C — Dashboard + sidebar

- Sidebar grouping with dividers between nav groups
- "Dashboard" nav label renamed to "Today"
- Collapsible "Admin" section in sidebar (cog icon, chevron rotates) containing: Team, Address Changes, Ward Boundary, Competitors
- Admin section visible to: candidate, campaign_manager, co_chair, field_organizer
- Candidate dashboard hero card: dark `bg-slate-900` with orange glow, race status headline, three stats
- Voter ID donut ring (hand-rolled SVG, no chart library) with For/Undecided/Against segments
- Needs-you queue: overdue follow-ups, pledged donors, walk lists >50% incomplete, address changes
- `getNeedsYouQueue(campaignId)` added to `src/lib/dashboard.ts`
- `canvassersOutToday` added to `getCandidateDashboardData` return value

### Competitor tracking (full feature — complete)

- Schema: `CampaignCompetitor` model + optional `competitorId` FK on `CanvassResponse`
- Migration: `20260422155416_add_other_candidate_outcome`
- Migration: `20260422164218_add_campaign_competitors`
- `src/lib/competitors.ts` — getCompetitors, addCompetitor, updateCompetitor, deleteCompetitor (soft delete)
- `src/app/(app)/campaign-settings/competitors/` — full settings page with add/edit/remove UI, optimistic updates
- Canvass screen: competitor picker (pill buttons) appears when "Other candidate" is selected and competitors exist
- `competitorId` flows through: offline queue → server action → sync → database
- Voter list row shows "Other candidate" outcome label
- Person detail shows "Supporting: [name]" on canvass history
- Walk list detail shows "Supporting: [name]" on canvass results
- Dashboard buckets `other_candidate` into Against Us in voter ID breakdown
- Dashboard competitor breakdown panel: count per competitor, sorted by count desc, max 5 rows + overflow
- CSV export includes "Competitor" column (populated when outcome is `other_candidate`)

### Voter list improvements

- Contact date ("Contacted Apr 2") and support level badge on each row
- "Not contacted" label for voters with no canvass response
- Status filter pills: All / Supporting / Undecided / Not supporting / Not contacted
- "After date" filter — shows as pill, opens native date picker on click, clears with ×
- Filter state managed via URL params (q, tag, supportFilter, contactedAfter)
- "Clear" filter link updated to slate underline pattern (T-03 consistency)

### Bug fixes

- Pre-existing Next.js 15 params bug fixed in `src/app/api/contact/[id]/read/route.ts` — params now awaited
- `other_candidate` badge style: `bg-slate-100 text-slate-700 border-slate-200`

---

## Session Log — April 23, 2026 (Mobile Nav, Canvass Screen, Voting History)

**Commits: ba6c171, bdaaffd, 88ff1de, 05c43c3, ec6ba3e**

### Mobile bottom navigation bar
- `src/components/layout/mobile-nav.tsx` — new component, role-aware bottom tab bar for mobile (below `md:` breakpoint only)
- `src/app/(app)/layout.tsx` — MobileNav imported and rendered, `pb-16 md:pb-0` added to main content wrapper
- Desktop sidebar untouched — mobile nav only renders below `md:` breakpoint
- Tab sets are role-aware: canvasser, field_organizer, volunteer_coordinator, finance_lead, super_user/super_admin each get a tailored set; candidate/campaign_manager/co_chair get a More sheet with overflow links
- Fixed build failure: `lucide-react` was missing from `package.json` — added via `npm install lucide-react`
- Fixed build failure: `Role` import from `@/types` caused Vercel module-not-found error — replaced with inline type definition in `mobile-nav.tsx`

### Mobile canvassing screen viewport fix
- `src/app/(app)/canvassing/[listId]/canvass/canvass-screen.tsx` — full viewport layout fix
- Outer wrapper changed to `h-screen [height:100dvh]` for Safari mobile browser chrome support
- Zone 2 (controls): removed `overflow-y-auto`, kept `flex-1 min-h-0 overflow-hidden` — controls no longer scroll
- Spacing tightened throughout: household card, resident queue, scale buttons, interest chips, other outcome toggle
- `showDetails` panel moved inside `<main>` content flow
- Footer `pb-3` → `pb-16` to clear mobile nav bar
- OfflinePill `bottom-20` → `bottom-36`
- All controls and Save & Next button now visible on one screen without scrolling

### Negative remaining count fix
- `src/app/(app)/canvassing/page.tsx` and `src/app/(app)/dashboard/_canvasser.tsx`
- `remaining` clamped with `Math.max(0, a.totalEntries - a.totalResponses)` to prevent negative values

### Voting history feature
- New `ElectionType` enum (`federal`, `provincial`, `municipal`) and `VotingRecord` model added to `prisma/schema.prisma`
- Migration: `20260423151852_add_voting_records`
- `src/lib/voting-records.ts` — `getVotingRecordsForPerson`, `addVotingRecord`, `updateVotingRecord`, `deleteVotingRecord`, `importVotingRecords`, `ELECTION_TYPE_LABELS`
- `src/app/(app)/voter-list/[personId]/page.tsx` — Voting History section added, visible to candidate/campaign_manager/co_chair only
- `src/lib/people.ts` and `src/app/(app)/voter-list/page.tsx` — `votedIn` filter added, visible to candidate/campaign_manager/co_chair only
- `src/app/(app)/voter-list/actions.ts` — `importVotingRecordRows` server action
- `src/app/(app)/voter-list/voting-history-template/route.ts` — template CSV download
- `src/app/(app)/voter-list/import-modal.tsx` — voting history note and template download link added

### Voters with history — hero card metric
- `src/lib/dashboard.ts` — `votingRecord.groupBy` query added to `getCandidateDashboardData`, returns `votersWithHistory`
- `src/app/(app)/dashboard/_candidate.tsx` — fourth stat added to hero card: "voters with history"

### Municipal voting history seed data
- `prisma/seed.ts` — 1,080 voting records across 480 voters (municipal only: 2014, 2018, 2022 Owen Sound Municipal Elections)
- Distribution: 15% of voters (225) have all three elections, 10% (150) have two, 7% (105) have one, 68% have none
- Deterministic — no `Math.random()`, same result every run
- Old mixed federal/provincial/municipal seed replaced entirely

### Infrastructure
- Migration applied to staging (Neon), production (localseat_prod), and demo (localseat_demo) databases
- All three environments reseeded with 1,080 voting records
- Demo repo pulled and rebuilt to match staging at commit `ec6ba3e`
- `git config core.autocrlf false` set on local repo to suppress line ending warnings
- Railway DATABASE_URL confirmed as local dev DB — Neon URL is the correct staging target

### Known issue added
- Staging DATABASE_URL must be the Neon connection string from Vercel environment variables, not the Railway URL in local `.env`

---

## Design System — Current Token Rules

### Active nav item
```
rounded-r-xl bg-slate-100 text-slate-900 font-semibold border-l-2 border-brand-500
```
Note: `rounded-r-xl` not `rounded-xl` — flat left edge required for `border-l-2` to sit flush.

### Inactive nav item hover
```
rounded-xl font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900
```

### Orange usage rule (T-03)
Orange (`brand-*`) is reserved for: brand logo mark, primary CTA buttons, focus rings, overdue/behind-pace states **only**.

Do NOT use orange for: progress bars, active nav, inline metric text, icon accents, text links.

### Progress bars
```
bg-slate-800  (not bg-brand-500)
```

### Inline text links
```
text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900
```

### Support rate colors

- ≥ 50%: `text-emerald-600`
- 30–49%: `text-amber-600`
- < 30%: `text-red-600`

### Sentiment scale (canvass screen 1–5)

```js
sentiment: {
  1: '#10b981',  // Strong Yes — emerald 500
  2: '#34d399',  // Soft Yes   — emerald 400
  3: '#f59e0b',  // Undecided  — amber 500
  4: '#f97316',  // Soft No    — orange 500
  5: '#ef4444',  // Strong No  — red 500
}
```

---

## Known Issues / Technical Debt

- `as unknown as` casts in several files where Prisma client types are stale — resolves automatically on next `npx prisma generate` when dev server is not holding the DLL (Windows EPERM issue)
- Voter list capped at 50 results — pagination is a follow-up item
- `SUPPORT_LEVELS` and `handleNotHome` in `canvass-screen.tsx` are unused locals (TS6133 hints only, not errors) — kept intentionally per spec
- Rate limiter resets on server restart (needs Redis for production scale)
- Offline queue is per-device only
- Demo site shares one database — multiple simultaneous users see each other's changes (deferred to Option 3)
- `localseat-staging` and `localseat.io` repos can drift out of sync — always copy `seed.ts` and key shared files when making changes that affect both
- Staging (Vercel/Neon) does not run migrations automatically — must be applied manually with `prisma migrate deploy` against the Neon `DATABASE_URL` whenever new migrations are added
- Seed guard added to `prisma/seed.ts` — exits with code 1 if `DATABASE_URL` contains `localseat_prod`. Runs before `bcrypt.hash` and before any `db.$transaction` calls.

---

## Map-Based Turf Cutting

- `src/lib/geocoding.ts` — `geocodeAddress(addressId)` and `geocodeAddressesForCanvassList(canvassListId)`
- Mapbox Geocoding API, country=ca, cached on Address record (lat/lng already set = no API call)
- Sequential geocoding with 600ms delay to respect rate limits
- `geocodeNewAddresses(campaignId, addressIds)` — fire-and-forget triggered after voter CSV import completes
- Migration: `20260420201655_add_turf_polygon_to_canvass_list` — adds `turfPolygon Json?` and `turfCreatedAt DateTime?` to CanvassList
- `/canvassing/turf` — map-based turf cutting page, managers only
- `TurfMapClient` — Mapbox GL JS + MapboxDraw, polygon-only draw, ray-cast point-in-polygon (no turf.js), orange circle markers, side panel with address preview and walk list creation
- `createTurfCanvassList` server action — creates CanvassList with turfPolygon, bulk-creates CanvassListEntries for all people at selected addresses
- "Draw turf" button added to `/canvassing` page, managers only
- `/canvassing/[listId]/map` — walk list map view, accessible to managers and assigned canvassers
- `ListMapClient` — colour-coded markers by support level then outcome, click → popup with name/address/support level/outcome/"View record" link, bottom-left legend, summary bar (total/contacted/not home/remaining)
- Auto-refresh every 30s on turf page when geocoding is in progress
- Warning banner when ungeocoded addresses exist
- "Map view" button added to `/canvassing/[listId]` page, visible to all roles
- All 555 Owen Sound seed addresses have pre-baked lat/lng in `GEOCODED_COORDS` in `prisma/seed.ts`
- `scripts/geocode-demo.ts` — one-time bulk geocoding script
- `scripts/export-geocoded-coords.ts` — exports geocoded coords from DB as TypeScript object
- Ward boundary overlay on `ListMapClient` and `TurfMapClient` — grey mask outside boundary, black line traces edge

---

## Ward Boundary

- `WardStatus` enum on `Person`: `not_checked | inside | outside | outside_accepted | pending_review`
- `wardBoundary Json?` and `wardBoundarySetAt DateTime?` added to Campaign model
- Migration: `20260421164841_add_ward_boundary`
- `src/lib/ward.ts` — `isPointInWard` (ray-cast), `campaignHasWard`, `parseKmlToGeoJsonPolygon`
- `/campaign-settings/ward` — manager page to draw or upload GeoJSON/KML ward boundary
- `/campaign-settings/ward/review` — review queue for outside-ward voters
- Ward check wired into voter CSV import and `addPersonAtDoor`
- Accessible to candidate, campaign_manager, co_chair only
- All save, clear, accept, and discard actions are audit logged

---

## Automated Tests (`src/__tests__/`)

- `canvass-response-dedup.test.ts`
- `canvasser-route-protection.test.ts`
- `export-membership-check.test.ts`
- `export-membership-revocation.test.ts`
- `outreach-import-batching.test.ts`
- `volunteer-shift-ownership.test.ts`

---

## Production Data Events

**April 23, 2026** — Production database manually cleaned via psql. Seed data (1,500 people, 555 addresses, 4 walk lists, 1 campaign, 13 seed users) was found in `localseat_prod` and removed. Superuser account preserved. Actual table names confirmed: `voting_records`, `volunteer_shifts`, `volunteer_shift_attendees`. Production is now empty and ready for real campaign data to be entered through the app UI.

---

## Remaining Work

### V1 — Not yet built

| Item | Priority | Effort |
|---|---|---|
| Voter list pagination (currently capped at 50) | High | Small |
| Activity timeline on person detail — unified chronological view | High | Small |
| PWA manifest, install prompt, offline fallback page | High | Small |
| Field organizer / canvasser / finance / volunteer coordinator dashboard hero cards | Medium | Medium |
| Donor tracking polish — add/edit flows review | Medium | Small |
| Address changes workflow end-to-end testing | Medium | Small |
| Deduplication UI review and testing | Low | Small |

### Active

| Item | Effort |
|---|---|
| Marketing site at localseat.io | Done |
| Operations guide document | Small |
| Text messaging (Telnyx + Stripe + approval + CRTC) | Large |
| Admin platform settings page | Done |
| Stripe payment integration on choose-plan page | Dev tier selector done. Stripe wiring remaining. |
| Update HANDOFF.md at end of each session | Ongoing |
| Map-based turf cutting | Done |
| Mobile bottom navigation bar | Done |
| Canvass screen viewport fix | Done |
| Voting history data model, import, and UI | Done |
| Voters with history hero card metric | Done |
| Municipal seed data | Done |
| Automated PostgreSQL backup to external storage (Backblaze B2 + rclone + cron) | Small |
| Demo instance isolation — Option 3 (unique DB per visitor) | Large |

---

## Roadmap Priority Order

1. Stripe payment integration (dev tier selector done, Stripe wiring remaining)
2. Telnyx SMS broadcast (decided, not built)
3. Two-factor authentication (2FA)
4. Events + public RSVP flows → feeds volunteer roster
5. Custom canvass survey fields
6. Simple automation rules (soft yes → auto follow-up)
7. Public volunteer signup / petition pages → feeds CRM
8. Automated PostgreSQL backups (Backblaze B2 + rclone)
9. Demo instance isolation (unique DB per visitor)

### Defined — Ready to Build When Scheduled

| Item | Effort |
|---|---|
| Official voter list reconciliation engine (4 prompts) — address normalization, fuzzy name matching, phone preservation, field-level merge control, manual review screen, unmatched record handling, audit trail, data quality scoring, import source labeling | Large |

### V2+ Backlog — Out of Scope for V1

Payment processing, online donations, mass texting, email broadcasts, predictive voter scoring, advanced analytics, native iOS/Android apps, social media publishing tools, party integrations (federal/provincial), multilingual interface, campaign branding/custom theming, federal/provincial compliance workflows.

---

## Key Files

```
/prisma
  schema.prisma        (includes PlatformSettings, CampaignOverride, CampaignCompetitor, PlanTier enum)
  seed.ts
/src
  /app
    /(auth)/login, /register, /verify-email, /resend-verification, /account-expired, /reset-password
    /(app)/dashboard, /voter-list, /voter-import, /canvassing, /follow-ups
             /outreach, /donors, /volunteers, /team, /campaigns, /account, /address-changes
    /(app)/campaign-settings/ward, /campaign-settings/competitors
    /admin/campaigns, /users, /audit-log, /export, /demo-leads, /account, /settings
    /admin/contact-submissions
    /onboarding/choose-plan, /create-campaign
    /demo
    /api/demo-leads
    /api/contact (POST — public)
    /api/contact/[id]/read (PATCH — super_user or super_admin)
  /lib
    auth.ts, db.ts, permissions.ts, sanitize.ts, rate-limit.ts
    email.ts, verification.ts, audit.ts, audit-descriptions.ts
    address-changes.ts, people.ts, canvassing.ts, outreach.ts, activity.ts
    offline-queue.ts, terms.ts, plan-limits.ts
    geocoding.ts, ward.ts, competitors.ts, dashboard.ts
  /components
    /layout/sidebar.tsx (collapsible Admin section — Team, Address Changes, Ward Boundary, Competitors)
    /ui/list-row.tsx (shared list row component — new April 22)
    /ui/badge.tsx (OutcomeBadge includes other_candidate)
    /ui/SyncStatusBar.tsx (replaced by inline offline pill on canvass screen)
  /hooks/useOfflineSync.ts
  /app/(app)/canvassing/[listId]/canvass/canvass-screen.tsx (household-first, 1-5 scale)
  /app/(app)/voter-list/filters-client.tsx (status + date filters — new April 22)
  /app/(app)/dashboard/_candidate.tsx (hero card, donut ring, needs-you queue)
/scripts/geocode-demo.ts
/scripts/export-geocoded-coords.ts
/public/sw.js
/var/www/marketing/
```

---

## How to Start the Next Session

1. `npm run dev`
2. Sign in at http://localhost:3001 (or 3000 if port is free)
3. Candidate access: alex.chen@example.com / password
4. Canvasser access: priya.nair@example.com / password
5. Admin access: superuser@localseat.io / password
6. Production: https://app.localseat.io
7. Demo: https://demo.localseat.io
8. Staging: https://localseat-staging.vercel.app
9. Provide prompts for the VS Code Claude plugin — not raw source code
10. All new development goes to `localseat-staging` repo first
11. Always test on staging before deploying to production
12. Production deploy: `git push origin main` → SSH → `cd /var/www/localseat && ./deploy.sh`
13. If staging DB schema is out of sync after pulling new migrations:
    ```
    $env:DATABASE_URL='<neon-connection-string>' ; npx prisma migrate deploy
    ```
    Get the Neon URL from Vercel → localseat-staging → Settings → Environment Variables → DATABASE_URL
14. Run `npx prisma generate` after any migration to clear stale type casts in the codebase
