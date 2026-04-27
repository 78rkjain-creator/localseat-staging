# LocalSeat.io — Handoff Notes

_Last updated: April 27, 2026 — Code quality sweep, security hardening (CSP, CSRF, session versioning, IDOR fix), demo infra consolidation._

## How I Work
- Provide prompts for VS Code Claude plugin — not raw source code
- Read existing files only when information is not already known from context
- Run commands one at a time — PowerShell does not support &&
- Never run audit-only prompts when answer can be inferred from context

---

## What This Is
Lightweight Canada-focused municipal campaign CRM and canvassing platform. Next.js, TypeScript, Tailwind CSS, PostgreSQL, Prisma. Production on Hostinger VPS.

---

## Tech Stack
- **Frontend/Backend:** Next.js 16, TypeScript, Tailwind CSS
- **Database:** PostgreSQL + Prisma ORM v5 — do not upgrade
- **Auth:** NextAuth.js v4, credentials provider
- **Email:** Nodemailer v8, Hostinger SMTP
- **SMS:** Telnyx (decided, not built)
- **Payments:** Stripe (decided, not built)
- **Maps:** Mapbox GL JS
- **Production:** Hostinger VPS (app.localseat.io)
- **Demo:** Hostinger VPS (demo.localseat.io)
- **Staging:** Vercel + Neon PostgreSQL (localseat-staging.vercel.app)
- **Local dev:** Windows, VS Code, Node v24

---

## Repos and URLs
- **Prod repo:** git@github.com:78rkjain-creator/localseat.io.git
- **Staging repo:** https://github.com/78rkjain-creator/localseat-staging.git
- **Local path:** C:\Users\rkjai\OneDrive\Desktop\localseat.io
- **Production:** https://app.localseat.io
- **Demo:** https://demo.localseat.io
- **Staging:** https://localseat-staging.vercel.app

---

## Infrastructure
- Hostinger VPS KVM2: IP 2.24.212.25, Ubuntu 24.04, 8GB RAM, 100GB NVMe
- Production: /var/www/localseat, PM2 `localseat`, port 3000
- Demo: /var/www/demo (second checkout of main repo, DEMO_MODE=true), PM2 `localseat-demo`, port 3001
- nginx: app.localseat.io → 3000, demo.localseat.io → 3001
- SSL: certbot, auto-renews
- Firewall: ports 22, 80, 443 open — 5432 blocked
- Demo reset cron: 3am (`npx prisma db seed`)
- DBs: `localseat_prod` (prod), `localseat_demo` (demo), Neon (staging)

---

## Deployment Workflow
1. Dev work → `git push origin main && git push staging main` (**both remotes every time**)
2. Vercel auto-deploys staging from the staging remote
3. **Test on staging before every production deploy**
4. SSH → `cd /var/www/localseat && ./deploy.sh`
5. **Always deploy app and demo together — never leave out of sync**

`deploy.sh` on both servers now runs `git checkout -- public/sw.js` before `git pull` to prevent sw.js build-stamp conflicts.

Demo deploy (same repo as prod, separate checkout at /var/www/demo with DEMO_MODE=true in .env):
```
cd /var/www/demo && ./deploy.sh
```

---

## Local Dev Commands
```
taskkill /F /IM node.exe
npm run dev
npx prisma generate
npx prisma migrate dev --name <name>
npx prisma migrate reset --force
npx prisma db seed
npm run typecheck
```

---

## Environment Variables

**Local `.env`**
```
DATABASE_URL="postgresql://postgres:!Kasliwal78!@localhost:5432/localseat_dev"
NEXTAUTH_SECRET="localseat-dev-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
SMTP_HOST="smtp.hostinger.com" | SMTP_PORT="465" | SMTP_SECURE="true"
SMTP_USER="info@localseat.io" | SMTP_PASS="<password>"
SMTP_FROM_WELCOME="hello@localseat.io"
SMTP_FROM_APPROVALS="approvals@localseat.io"
NEXT_PUBLIC_STRIPE_ENABLED="false"
```

**Production** (`/var/www/localseat/.env`)
```
DATABASE_URL="postgresql://localseat:LS_Prod_2026x@localhost:5432/localseat_prod"
NEXTAUTH_URL="https://app.localseat.io"
DEMO_WEBHOOK_SECRET="localseat-demo-webhook-2026"
NEXT_PUBLIC_STRIPE_ENABLED="false"
```

**Demo** (`/var/www/demo/.env`) — second checkout of the main repo at /var/www/demo
```
DATABASE_URL="postgresql://demo:LS_Demo_2026x@localhost:5432/localseat_demo"
NEXTAUTH_SECRET="localseat-demo-secret-2026"
NEXTAUTH_URL="https://demo.localseat.io"
DEMO_MODE="true"
SKIP_EMAIL_VERIFICATION="true"
NEXT_PUBLIC_STRIPE_ENABLED="false"
```

**Staging (Vercel)**
```
DATABASE_URL="<Neon connection string>"
NEXTAUTH_URL="https://localseat-staging.vercel.app"
NEXT_PUBLIC_STRIPE_ENABLED="false"
```

---

## Seed Users (password: `password`)

| Email | Role |
|---|---|
| superuser@localseat.io | super_user |
| demo@localseat.io | candidate (demo entry) |
| alex.chen@example.com | candidate |
| maria.santos@example.com | campaign_manager |
| claire.morgan@example.com | co_chair |
| robert.bell@example.com | co_chair |
| james.okafor@example.com | field_organizer |
| sarah.kim@example.com | field_organizer |
| priya.nair@example.com | canvasser |
| kevin.lafleur@example.com | canvasser |
| amy.zhang@example.com | canvasser |
| tom.okonkwo@example.com | canvasser |
| sara.bishop@example.com | volunteer_coordinator |
| dan.wu@example.com | finance_lead |
| mike.davidson@example.com | sign_installer |

After any reseed: sign out and back in to refresh JWT.

Seed creates 8 default tags per campaign: Volunteer, Donor, Endorser, Sign location, Do not contact, Media, VIP, Influencer.

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
                    └── Sign Installer
```

**Role permissions summary:**
- candidate + campaign_manager: full access
- co_chair: read-only on most things, write on canvassing/ward/competitors/script
- field_organizer: canvassing, follow-ups, outreach, volunteers, team (add canvasser/sign_installer only)
- canvasser: canvassing only
- volunteer_coordinator: volunteers, canvassing
- finance_lead: donors only
- sign_installer: signs only

**Role management:**
- Candidate and campaign_manager can change roles on /team page
- Campaign_manager cannot assign or change candidate role
- Superuser can change roles from /admin/users/[userId]
- Transferring candidate role requires choosing former candidate's new role (modal)
- Field organizer can add canvassers and sign installers only
- Team Setup (/team) is under the Admin collapsible section in the sidebar (not a top-level nav item)

---

## Migrations (in order)
```
20260412210149_init
20260413131552_add_canvass_list_entries
20260413173043_rename_support_levels
20260414013251_outreach_log_updates
20260414020402_donor_tracking
20260414130234_add_co_chair_role
20260414134633_volunteer_coordinator
20260415135131_rename_phone_fields
20260415183445_add_support_level_to_person
20260415201732_add_performance_indexes
20260415230050_add_soft_delete
20260415233405_add_platform_role
20260416000001_add_email_verification
20260416000002_add_address_change_requests
20260416000003_add_terms_acceptance
20260416000005_add_password_reset_token
20260416183449_add_address_change_requests
20260417000001_add_canvass_response_unique_constraint
20260417000002_add_poll_number_and_import_source
20260419203313_add_demo_registration
20260420004502_add_demo_registration_emailed_at
20260420132115_add_plan_tiers_and_overrides
20260420155334_add_contact_submission
20260420201655_add_turf_polygon_to_canvass_list
20260421164841_add_ward_boundary
20260422155416_add_other_candidate_outcome
20260422164218_add_campaign_competitors
20260423151852_add_voting_records
20260424143652_add_voter_change_requests
20260424150256_add_voter_change_request_type
20260424182540_add_canvass_script
20260424220740_add_custom_fields
20260424222844_add_list_import_models
20260424225222_add_is_confirmed_voter
20260424230216_add_telephone_list_type
20260424230755_add_review_reason
20260425044820_add_sign_installer_role
20260425044915_add_signs_model
20260425045245_add_volunteer_follow_up_task_type
20260425120000_tag_tenancy_and_support_level_enum
20260425130000_person_birth_date
20260425140000_person_list_source
20260425150000_people_restructure_foundation
20260425160000_add_not_required_approval_status
20260426000001_add_ood_request_fields
20260427000001_add_session_version
```

---

## Key Models
- Campaign, User, CampaignMembership, AuditLog, PlatformSettings
- Person, Household, Address, Tag, Note, Task
- CanvassList, CanvassListEntry, CanvassAssignment, CanvassResponse
- OutreachLog, DonorRecord, VolunteerRecord, VolunteerShift
- VotingRecord (ElectionType: federal/provincial/municipal)
- ListImport, PersonListMembership (list import tracking)
- Sign (SignStatus: to_be_installed/installed; SignLocationType: residential/non_residential)
- CampaignCompetitor, AddressChangeRequest, ContactSubmission

**Key enums:**
- Role: candidate, campaign_manager, co_chair, field_organizer, canvasser, volunteer_coordinator, finance_lead, sign_installer
- PlatformRole (on User): super_user, super_admin
- ListImportType: list, telephone_list, official_voters_list
- PersonListMembershipStatus: matched, created, pending_review, accepted
- SignStatus: to_be_installed, installed
- TaskType: includes volunteer_follow_up
- ListSource: voters_list, residents_list, manual, canvass, team
- SupportLevel enum: strong_yes, soft_yes, undecided, soft_no, strong_no (on both Person and CanvassResponse)
- OutOfDistrictApprovalStatus: not_required, pending, approved, rejected

**Key Person fields:**
- isConfirmedVoter (bool) — set true on OVL match
- pollNumber — wired through full import pipeline
- wardStatus: not_checked | inside | outside | outside_accepted | pending_review
- customFieldValues (Json) — up to 5 campaign-defined fields
- birthDate (DateTime, nullable) — replaced birthYear (Int); CSV import accepts "Birth Date" (YYYY-MM-DD), legacy "Birth Year" still accepted with deprecation warning
- listSource (ListSource, required) — set on creation; manual + out-of-ward records auto-excluded from walk lists
- includeInWalkLists (Boolean, default false) — override: set true to include a manual or out-of-ward person on walk lists
- userId (String?, FK→User) — links a team member's User to their Person record; @@unique([userId, campaignId]) partial index (WHERE userId IS NOT NULL)
- needsDistrictClassification (Boolean, default false) — triggers classify banner/modal; cleared once classification decision is saved
- isOutOfDistrict (Boolean, default false) — true only when approved OOD status
- outOfDistrictApprovalStatus (OutOfDistrictApprovalStatus?) — pending | approved | rejected | not_required
- outOfDistrictRequestedById, outOfDistrictRequestedAt, outOfDistrictRejectionReason — FO approval workflow fields

**Key Campaign fields:**
- customFields (Json) — defines up to 5 field labels
- wardBoundary (Json) — Polygon or MultiPolygon
- canvassScript (String)

---

## Key Features

### Import System
- Three import types: List (named), Telephone List (named), Official Voters List
- OVL matching: full match (name+address) → auto confirm voter; partial match → review queue; no match → auto create
- Address normalization: `src/lib/address-normalize.ts` — handles abbreviations, directionals, unit numbers
- Review queue at `/voter-import/review` with bulk accept
- ListImport + PersonListMembership track every import event per person

### Residents List vs Voter List
- `/people/residents` — all residents (Residents List tab)
- `/people/voters` — confirmed voters only (isConfirmedVoter === true)
- Old `/voter-list/*` routes permanently redirect to `/people/*` equivalents via next.config.ts
- Person detail shows Residents List section (all named list memberships) and Voter List section (OVL matches)

### Custom Fields
- Defined at campaign level in `/campaign-settings/custom-fields` (candidate/campaign_manager only)
- Up to 5 fields per campaign, each a label + text value per person
- Editable on person detail, importable via CSV (column headers match field labels)
- Filter buttons on Residents List page filter by field presence (AND logic)
- Orphan cleanup runs on definition save
- Exported to Residents List CSV (one column per defined field, in definition order)

### Tags
- Campaign-scoped: Tag has `campaignId`, unique on `(campaignId, name)` — tags are not shared across campaigns
- 18-tag cap per campaign; 8 default tags seeded (Volunteer, Donor, Endorser, Sign location, Do not contact, Media, VIP, Influencer)
- Creation / rename / delete: candidate and campaign_manager only, at `/campaign-settings/tags`
- Attach / detach: field_organizer and above
- Delete blocked if tag is in use (personCount > 0); hard delete (no soft delete — unique constraint would block re-creation)
- TagPicker component (`src/components/ui/tag-picker.tsx`): click-to-open dropdown with search, no inline creation

### Add Resident
- `/people/new` — available to candidate, campaign_manager, field_organizer
- Sets `listSource = manual`; these records are auto-excluded from walk lists unless `includeInWalkLists = true`
- Address: search existing (combobox via `/api/addresses/search`) or enter manually

### listSource and Walk List Eligibility
- Every Person has a required `listSource`: voters_list, residents_list, manual, or canvass
- Walk list / canvass list generation excludes `manual` records and `wardStatus` of `outside` or `pending_review` unless `includeInWalkLists = true`
- Filter logic lives in `src/lib/canvassing.ts` (`previewPeopleFilter`)

### Walk List Progress
- All six progress-tracking locations now count **distinct personIds** (not raw response count): `getAssignedLists`, `getCanvassLists`, `getCandidateDashboardData`, `getFieldOrganizerDashboardData`, `getNeedsYouQueue`, canvasser dashboard
- Display layer caps pct at 100% and shown count at totalEntries as defense in depth

### Poll Number Display
- `src/lib/format-poll-number.ts`: returns raw value when set; "Pending OVL" when `wardStatus` is `not_checked` or `pending_review`; "Unknown" when settled-but-null
- Display-only helper — CSV export always uses the raw nullable value

### Service Worker Cache Busting
- `scripts/stamp-sw.mjs` runs before every build (`npm run build`): replaces `CACHE_NAME` in `public/sw.js` with a timestamp string
- Combined with existing `skipWaiting()` and `clients.claim()` in the SW, this forces a clean cache reload on every deploy

### Signs
- `/signs` — accessible to all roles including sign_installer
- Residential signs linked to address record; non-residential use free-form text
- Status toggle: to_be_installed → installed (sets installedBy + installedAt)
- All roles can add signs

### Volunteer Pipeline
- Canvass volunteer interest → upserts VolunteerRecord (fixes silent no-op on re-canvass)
- Auto-creates volunteer_follow_up Task assigned to field_organizer (cascade: field_org → campaign_manager → candidate)

### Pagination
- Residents List: 50/page, desktop numbered buttons (7 max with ellipsis), mobile prev/next
- Filter counts show "X of Y" when filters active
- Page in URL (?page=N), filter change resets to page 1

### Map / Turf
- `src/lib/geocoding.ts` — Mapbox geocoding, cached on Address, 600ms delay
- `/canvassing/turf` — polygon draw, ray-cast point-in-polygon, managers only
- `/canvassing/[listId]/map` — colour-coded markers, 30s auto-refresh
- Ward boundary: Polygon or MultiPolygon, GeoJSON/KML/KMZ upload (Represent API picker removed — unreliable)
- All 555 Owen Sound addresses have pre-baked lat/lng in seed

### People Section
- 5 tabs: Master List (/people), Residents List (/people/residents), Voter List (/people/voters), Out of District (/people/out-of-district), Team (/people/team)
- Permission gates: Master List, Out of District, Team = candidate, campaign_manager, field_organizer. Residents List adds canvasser, volunteer_coordinator. Voter List adds canvasser.
- Old /voter-list/* routes permanently redirect to /people/* equivalents via next.config.ts
- Person.userId links User to Person (team-as-people). @@unique([userId, campaignId]) with partial index (WHERE userId IS NOT NULL).
- ListSource enum includes: voters_list, residents_list, manual, canvass, team
- Team members auto-created as Person records when added to campaign via /team
- District classification modal triggers on team add: Inside (address required), Outside, I don't know yet
- Bulk classify modal accessible from Master List banner when needsDistrictClassification = true
- Out-of-district marks: candidate/CM = auto-approved, field_organizer = pending approval
- Approval queue at /people/out-of-district/pending (candidate/CM only)
- Sidebar badge shows pending count for candidate/CM
- OutOfDistrictApprovalStatus enum: not_required, pending, approved, rejected
- Pending marks do NOT exclude from walk lists — exclusion only on approved
- Team members skip the OOD approval flow entirely

### Code Quality (April 27, 2026)
- Deleted ~1,800 lines of dead /voter-list code (10 files). Redirect stubs remain at voter-list/page.tsx, confirmed/page.tsx, confirmed/[personId]/page.tsx
- Consolidated duplicated logic: `mergePersons` → `src/lib/people.ts`, `requireSuperUser` / `requirePlatformAdmin` → `src/lib/permissions.ts`, classify actions unified in `src/lib/classify-actions.ts` with shared modal in `src/components/classify-modal.tsx`. Old files are thin re-exports
- Added try-catch error handling to all server actions with DB writes (28 action files) and all 5 export route handlers
- Removed 4 debug console.log statements from follow-ups
- Removed `typescript.ignoreBuildErrors: true` from next.config.ts — build passes clean
- Removed `as any` casts on votingRecord (8 occurrences across voting-records.ts and dashboard.ts)
- Moved `@types/nodemailer` from dependencies to devDependencies
- Standardized 11 PascalCase .tsx files to kebab-case (e.g., WardMapClient.tsx → ward-map-client.tsx)
- Fixed N+1 in geocoding: batch findMany + $transaction instead of per-address findUnique + update
- Fixed N+1 in voter import: pre-fetch all people/addresses into memory maps, batch creates at end. ~10,000 DB queries → ~8 for a 2,000-row import
- Converted team management from API route handlers (/api/team/*) to server actions in `src/app/(app)/team/actions.ts`. 4 route handler files deleted
- Deleted unused `src/components/ui/sync-status-bar.tsx`

### Offline Queue
- Retry state persisted in IndexedDB (survives page reload)
- Dead-letter: parked after 3 lifetime attempts
- No head-of-line blocking: flush loop continues past failing items
- Failure classification: network = transient retry, permanent: true = park immediately, other errors = count toward cap
- saveCanvassResponse returns permanent: true for assignment/person not found
- UI: pending count pill, syncing indicator, parked count with "review" tap target
- ParkedPanel: per-item error display, retry and discard buttons
- IndexedDB schema v2: added retryCount, lastAttemptedAt, lastError, status fields

### Security
- Security headers in next.config.ts: X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy
- Content-Security-Policy header in next.config.ts: self, unsafe-inline, Google Fonts, Mapbox (tiles/events/API), blob: workers
- CSRF origin check helper in `src/lib/auth.ts` (`checkOrigin`). Applied to contact, demo-leads, and contact/[id]/read route handlers
- Competitor IDOR fixed: server reads `activeCampaignId` from session instead of accepting it from the client
- Session versioning: `sessionVersion` field on User, incremented whenever a member is removed or restored, checked on every JWT token refresh. Mismatch sets `sessionExpiresAt: 0` → proxy forces re-auth
- Demo rate limiting: 10 registrations per IP per hour on `registerDemo` action
- Session timeout: 8h all roles, 4h canvassers (checked in proxy.ts)
- Rate limiting on auth routes
- Input sanitization on canvassing and outreach actions
- nodemailer v8 (SMTP injection CVEs patched)

---

## Key Files
```
/prisma/schema.prisma, seed.ts
/src/app/(auth)/login, register, verify-email, resend-verification, reset-password
/src/app/(app)/
  dashboard, people, voter-import, canvassing, follow-ups
  outreach, donors, volunteers, team, signs, campaigns, account, address-changes
  campaign-settings/ward, competitors, script, custom-fields
  voter-import/review
  people/[personId]/out-of-district-actions.ts, out-of-district-control.tsx
  people/classify-banner.tsx (thin re-export wrapper)
  people/out-of-district/pending/page.tsx, queue-row.tsx
  people/residents/page.tsx, filters-client.tsx
  people/team/page.tsx
  people/voters/page.tsx
  team/actions.ts (team server actions — add, remove, restore, list members)
  team/classify-actions.ts, team/classify-modal.tsx (thin re-exports)
/src/app/admin/campaigns, users, audit-log, export, demo-leads, settings
/src/app/onboarding/choose-plan, create-campaign
/src/lib/
  auth.ts, db.ts, permissions.ts, sanitize.ts, rate-limit.ts
  people.ts, canvassing.ts, outreach.ts, activity.ts, dashboard.ts
  geocoding.ts, ward.ts, address-normalize.ts, competitors.ts
  email.ts, audit.ts, terms.ts, plan-limits.ts, offline-queue.ts
  format-poll-number.ts, classify-actions.ts
/src/components/classify-modal.tsx (shared classify modal — used by people/ and team/ re-exports)
/src/components/layout/sidebar.tsx, mobile-nav.tsx
/src/components/ui/tag-picker.tsx, address-picker.tsx
/src/hooks/useOfflineSync.ts
/public/sw.js
/scripts/geocode-demo.ts, export-geocoded-coords.ts, stamp-sw.mjs
/src/app/(app)/campaign-settings/tags/
/src/app/(app)/people/new/
/src/app/api/addresses/search/route.ts
/NEXT_SESSION_PROMPTS.md
/var/www/marketing/
```

---

## Design System
**Active nav:** `rounded-r-xl bg-slate-100 text-slate-900 font-semibold border-l-2 border-brand-500`
**Inactive nav hover:** `rounded-xl font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900`
**Orange rule:** brand-* reserved for logo, primary CTA, focus rings, overdue states only. Never for progress bars, nav, metrics, links.
**Progress bars:** `bg-slate-800`
**Text links:** `text-slate-900 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-900`
**Support rate:** ≥50% emerald-600, 30-49% amber-600, <30% red-600
**Sentiment scale:** 1=emerald-500, 2=emerald-400, 3=amber-500, 4=orange-500, 5=red-500

---

## Automated Tests (`src/__tests__/`)
- canvass-response-dedup.test.ts
- canvasser-route-protection.test.ts
- export-membership-check.test.ts
- export-membership-revocation.test.ts
- outreach-import-batching.test.ts
- volunteer-shift-ownership.test.ts

---

## Known Issues / Technical Debt
- `as unknown as` Prisma casts in several files — resolves on next `npx prisma generate` when dev server not holding DLL
- Rate limiter resets on server restart — needs Redis for production scale
- Offline queue is per-device only
- Demo site shares one DB — multiple simultaneous users see each other's changes (deferred)
- Both remotes (origin + staging) must be pushed on every deploy — `git push origin main && git push staging main`. Forgetting one causes demo/staging or prod to fall behind
- Staging Neon DB must have migrations applied manually (`prisma migrate deploy`) — Vercel does not auto-run migrations
- EPERM on Windows during `prisma generate` = known DLL lock from running dev server, not a real error
- Seed data: Downtown East Route has 38 entries but seed creates ~139 canvass responses (~3.6 per door). Not a bug — distinct-personId counting handles it correctly. Just an artifact of the seed data volume.
- After `prisma migrate dev` reset, team Person backfill must be run manually — migration backfill runs before seed data exists. Use backfill.sql at repo root.
- Duplicate migration names can occur if Prisma prompts for a new migration name after reset — delete the duplicate folder and resolve with `prisma migrate resolve --rolled-back`.

---

## Production Data Events
**April 23, 2026** — Production DB manually cleaned. Seed data removed. Superuser preserved. Production is empty and ready for real campaign data.

**April 26, 2026** — People restructure deployed. 3 migrations applied to prod (people_restructure_foundation, add_not_required_approval_status, add_ood_request_fields). No data loss. Staging, prod, demo all in sync.

**April 27, 2026** — Code quality sweep and security hardening. Migration `add_session_version` applied (adds `sessionVersion Int @default(0)` to users table). No data loss. CSP header live. Deploy scripts updated with sw.js checkout step. Demo directory deleted — demo now runs from main codebase. Both remotes (origin + staging) must be pushed on every deploy going forward.

---

## Remaining Work

### Deployed
| Item | Notes |
|---|---|
| People restructure — 5 tabs (/people/*), team-as-people, district classification, FO out-of-district approval flow | Deployed April 26, 2026 |
| Offline queue persistence — retry state in IndexedDB, parked items, no head-of-line blocking | Deployed April 26, 2026 |
| Code quality sweep — dead code deleted, N+1 queries fixed, try-catch on all DB server actions, `as any` removed, PascalCase files renamed, team management moved to server actions, debug logs removed | April 27, 2026 |
| Security hardening — CSP header, CSRF origin check, competitor IDOR fix, session versioning, demo rate limiting | April 27, 2026 |
| Demo infra consolidation — demo/ directory deleted, demo now runs from main codebase with DEMO_MODE=true | April 27, 2026 |

### High Priority
| Item | Effort |
|---|---|
| Activity timeline on person detail | Small |
| PWA manifest and install prompt — SW cache busting shipped; manifest and install prompt still needed | Small |

### Medium Priority
| Item | Effort |
|---|---|
| Codex cleanup prompts 3–8 (auth centralization, import contracts, person detail split, custom field lifecycle, naming, maintainability audit) | Medium |
| Role-specific dashboard hero cards (field_org, canvasser, finance, volunteer_coord) | Medium |
| Donor tracking polish | Small |
| Address changes end-to-end testing | Small |

### Low Priority
| Item | Effort |
|---|---|
| Deduplication UI review | Small |
| jszip to package.json (KMZ upload prod support) | Small |
| Automated PostgreSQL backups (Backblaze B2 + rclone) | Small |

### Active / In Progress
| Item | Status |
|---|---|
| Stripe payment integration | Dev tier selector done, Stripe wiring remaining |
| Telnyx SMS (+ Stripe + CRTC approval) | Decided, not built |
| Demo instance isolation (unique DB per visitor) | Large, deferred |
| Operations guide document | Small |
| Update HANDOFF.md each session | Ongoing |

---

## Roadmap
1. Stripe payment integration
2. Telnyx SMS broadcast
3. Two-factor authentication (2FA)
4. Events + public RSVP → feeds volunteer roster
5. Custom canvass survey fields
6. Simple automation rules (soft yes → auto follow-up)
7. Public volunteer signup / petition pages → feeds CRM
8. Automated PostgreSQL backups
9. Demo instance isolation

### Defined — Ready to Build
| Item | Effort |
|---|---|
| Official voter list reconciliation engine — address normalization, fuzzy name matching, phone preservation, field-level merge, manual review, unmatched handling, audit trail, data quality scoring | Large |

### V2+ Out of Scope
Payment processing, online donations, mass texting, email broadcasts, predictive scoring, advanced analytics, native apps, social media tools, party integrations, multilingual, custom theming, federal/provincial compliance.

---

## How to Start the Next Session
1. `npm run dev`
2. Sign in at http://localhost:3000
3. Candidate: alex.chen@example.com / password
4. Canvasser: priya.nair@example.com / password
5. Admin: superuser@localseat.io / password
6. All new dev → localseat-staging repo first
7. Test on staging before production deploy
8. Production deploy: `git push origin main && git push staging main` → SSH → `cd /var/www/localseat && ./deploy.sh`
9. If staging DB schema out of sync: `$env:DATABASE_URL='<neon-url>' ; npx prisma migrate deploy`
10. Run `npx prisma generate` after any migration
11. After any `prisma migrate dev` reset, run backfill.sql to create team Person records (seed data doesn't exist when migrations run)
