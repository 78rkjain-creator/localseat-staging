# LocalSeat.io — Handoff Notes

_Last updated: April 29, 2026 — Batch 11: Import & Data Management hub, voter-list expansion, team CSV/XLSX import, review UX overhaul, voter phone fields decoupled from required._

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
- Daily summary cron: 7am (`curl -s -X POST https://app.localseat.io/api/cron/daily-summary -H "x-cron-secret: $CRON_SECRET"`)
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
CRON_SECRET="localseat-cron-2026-secret"
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
20260427000002_remove_canvass_response_unique
20260427000003_add_sort_order_to_canvass_list_entry
20260427000004_add_daily_summary_enabled
20260427000005_add_daily_summary_email
20260427000006_canvass_list_status_and_dynamic
20260427000007_add_voter_id
20260427000008_add_appointment_task_type
20260427000009_add_events
20260427000010_add_field_messages
20260427000011_add_surveys_and_signatures
20260427000012_add_privacy_fields
20260428000001_add_fundraising_goal
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
- Event, EventAttendee (EventType: canvass_event/phone_bank/meeting/fundraiser/other; EventStatus: scheduled/in_progress/completed/cancelled)
- FieldMessage (FieldMessagePriority: normal/urgent)
- Survey, SurveyQuestion (SurveyQuestionType: text/single_choice/multi_choice/rating/yes_no), SurveyResponse
- SignatureRecord

**Key enums:**
- Role: candidate, campaign_manager, co_chair, field_organizer, canvasser, volunteer_coordinator, finance_lead, sign_installer
- PlatformRole (on User): super_user, super_admin
- ListImportType: list, telephone_list, official_voters_list
- PersonListMembershipStatus: matched, created, pending_review, accepted
- SignStatus: to_be_installed, installed
- TaskType: includes volunteer_follow_up, appointment
- CanvassListStatus: draft, pending_approval, active, archived
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
- voterId (String?, unique per campaign) — voter ID from OVL import; used for voter ID matching on reimport
- anonymizedAt (DateTime?) — set when record is anonymized; locks editing and replaces PII with placeholders

**Key CanvassList fields:**
- status (CanvassListStatus) — draft, pending_approval, active, archived
- dynamicFilters (Json?) — stored filter criteria for auto-updating lists
- lastRefreshedAt (DateTime?) — last time dynamic list was rebuilt

**Key CanvassListEntry fields:**
- sortOrder (Int) — explicit display/route order; updated by route optimization

**Key Campaign fields:**
- customFields (Json) — defines up to 5 field labels
- wardBoundary (Json) — Polygon or MultiPolygon
- canvassScript (String)
- dailySummaryEmail (Boolean, default false) — enables daily email report to candidate/CM
- dataRetentionMonths (Int?) — policy setting (not enforced automatically)
- electionDate (DateTime?) — stored on Campaign, shown/edited in General Settings
- fundraisingGoal (Int?) — dollar goal shown in General Settings; added in migration 20260428000001

---

## Architecture Patterns

**Import & Data Management hub**  
`/import` is the home for all bulk-data ops. Future imports (donor lists, walk lists, etc.) follow this pattern:
- Add a card to `src/app/(app)/import/page.tsx`
- Page at `/import/<name>`
- Parser in `src/lib/<name>-csv-import.ts` (mirrors csv-import.ts shape)
- Server action with `checkExisting*` + `commit*` + `applyTags*` helpers
- Reuse `parseAddress`, `parseTagList`, the grouped review UX, and `ExportFixModal` where possible

**Smart address parser**  
`src/lib/address-parser.ts` handles Canadian address formats. Any new import accepting addresses should call `parseAddress()` when given a combined "Address" column. Splits "2015-5 Massey Sq" into unit=2015 / num=5 / name=Massey Sq, etc.

**Grouped review UX**  
`csv-import.ts` exports `classifyRow` + `listMissingFields`. `ReviewBucket` has four states. Review screen renders four collapsible sections with bucket-specific bulk actions. Reusable pattern for any future import.

**Row caps**
```
VOTER_LIST_ROW_CAP = 10_000  (src/lib/csv-import.ts)
TEAM_ROW_CAP       = 1_000   (src/lib/team-csv-import.ts)
```
Both parsers (CSV and XLSX) for both flows enforce these caps before any row processing — bail out fast on oversized files. The splitter for >10k row imports is queued (Prompt C) but not yet built.

**Permission gates for /import**
- `canAccessImportHub` — sidebar visibility + `/import` page gate
- `canManageVoterList` — voter list import + duplicate detection + review queue (manager-only)
- `canImportTeam` — team import (manager + co_chair + field_organizer)

---

## Business Rules / Field Decisions

**Voter list — phone fields are PERMANENTLY OPTIONAL.**  
Both `phoneHome` and `phoneMobile` are optional for voter-list imports. Voter lists from city clerks, party canvasses, and other sources frequently have no phone numbers. This is final — do not add a phone-required gate to the voter-list classifier in the future.

**Team import — phone REQUIRED.**  
At least one of `phoneHome` or `phoneMobile` must be present for team-import rows. Team members have active campaign roles and need a contact channel. Different rule from voter list, intentional. The classifier in `src/lib/team-csv-import.ts` enforces this.

**Team import — role validation at parse time.**  
Invalid roles (e.g. "Captain") are caught at parse time and routed to the `missing_required` bucket with a clear "Role (invalid: X)" annotation. Server-side validation is still in place as defense in depth.

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

### Canvassing Screen Enhancements
- Navigate button + phone/SMS links on canvassing screen (tel:/sms: links; home phone SMS shows warning that it may be a landline)
- Back button on canvassing screen — navigates to previous entry without saving current responses
- Walk time estimates (~X min walk to next address, last stop indicator) using Haversine distance
- Next stop navigation (Google Maps walking directions from current address to next)
- Appointment scheduling from canvassing screen (date/time picker, creates appointment Task, badge shown when appointment pending)
- Survey panel on canvassing screen (collapsible, driven by active survey for the list; answers saved with canvass response)
- Digital signature capture on canvassing screen (canvas-based pad, optional; thumbnails appear on person detail)
- Building/apartment grouping on canvassing screen — multi-unit addresses shown as one stop, units sorted numerically

### Walk Lists
- Walk list approval workflow — field organizer-created lists enter pending_approval status; candidate/CM approve before activation
- Walk list status lifecycle: draft → pending_approval → active → archived
- Dynamic walk lists — auto-rebuild from stored filter criteria; live match count during creation, lastRefreshedAt tracked
- Walk list archive (soft deactivate for lists with data) and delete (hard delete if no responses)
- Walk list edit — rename and manage entries inline
- Route optimization — nearest-neighbor Haversine heuristic reorders CanvassListEntry.sortOrder for efficient walking route
- Printable walk lists — browser print-to-PDF with @media print CSS; roster format with address/resident rows
- Building/apartment grouping on walk list page — multi-unit addresses grouped, units sorted numerically

### Dashboards and Analytics
- Canvasser self-stats dashboard (doors knocked total, doors today, signs requested, volunteer interests, follow-ups created)
- Canvasser performance leaderboard on manager dashboard
- Live activity feed on manager dashboard with 30-second auto-refresh (`/api/dashboard/canvass-activity`)
- Analytics dashboard at `/analytics` — 4 Recharts charts: support trend over time, doors per day, canvasser performance comparison, support level distribution (candidate/CM only)
- Scheduled daily email reports — toggle in campaign settings (`dailySummaryEmail`), `/api/cron/daily-summary` endpoint secured by `x-cron-secret` header, 7am cron on VPS

### Map and Turf
- Campaign contact map at `/people/map` — Mapbox GL JS, color-coded markers by support level, filters panel, ward boundary overlay, GeoJSON upload for boundary import
- Pin drop contact creation on map — click map to place pin, reverse geocoding fills address, creates new Person record
- Interactive turf cutting at `/canvassing/turf` — draw polygons, create walk lists from selection, existing turf overlays shown

### Events
- Campaign events system at `/events` — create events (canvass_event/phone_bank/meeting/fundraiser/other), link to walk lists, attendee management
- Event check-in and check-out tracking per attendee
- Event status lifecycle: scheduled → in_progress → completed / cancelled

### Field Messages
- Field messaging at `/field-messages` — managers push notes to canvassers, urgent/normal priority
- Dismissible banners on canvassing screen for active messages
- Message expiry — field messages auto-hide after expiry date
- Urgent messages shown with distinct styling

### Survey Builder
- Survey builder at `/campaign-settings/surveys` — create/edit surveys with 5 question types: text, single_choice, multi_choice, rating, yes_no
- Reorder questions via drag-handle, mark questions required, live preview
- Surveys linked to canvass lists; active survey auto-loads on canvassing screen
- Survey answers saved with CanvassResponse in SurveyResponse record

### Digital Signatures
- Canvas-based signature pad (Pointer Events API, touch-friendly)
- Purpose selection: lawn_sign_consent, volunteer_consent, petition, other
- Signature thumbnails displayed on person detail page with purpose/date/collector labels
- Signature records visible in consent log on Privacy dashboard

### Privacy and Data Management
- Privacy dashboard at `/campaign-settings/privacy` — data inventory stats (total, with phone %, with email %, canvassed %, anonymized %), data retention policy setting, consent log of last 25 signatures
- Data anonymization — one-click anonymize any person record (candidate/CM only): clears name, phone, email, DOB, custom fields; sets `anonymizedAt`; canvass history preserved for statistics
- Anonymized records show "Anonymized" badge on person detail, editing locked, ContactDropdown hidden

### Duplicate Finder (Configurable)
- `/people/duplicates` — user selects match fields (first name, last name, birth date, phone home, phone mobile, email, address) then fetches groups
- Server action `findDuplicates(matchFields)` in `src/app/(app)/people/duplicates/actions.ts` — loads up to 5000 persons, builds composite key from selected fields (null fields excluded so null≠null), groups by key, returns groups of 2+ sorted by size desc, capped at 100
- UI in `src/app/(app)/people/duplicates/duplicates-ui.tsx` — field selector checkboxes, group cards showing all records in a match group, "Not duplicates" dismiss per group
- Merge modal: auto-selects record with most canvass responses as winner; swap button to change primary; per-field radio where values differ (auto-selects non-blank side); address kept as-is with info note; calls `mergeDuplicateRecords` on confirm
- `mergeDuplicateRecords({ winnerId, loserId, fieldChoices })` in same actions.ts — applies field choices to winner, transfers tags (createMany skipDuplicates), transfers canvassResponses / outreachLogs / tasks / notes / surveyResponses / signatureRecords (updateMany), handles personListMemberships with conflict check (loop), preserves loser's userId if winner has none, soft-deletes loser, adds merge note, audit log — all in `$transaction`

### Team Member Linking
- `Person.userId` (String?, FK→User) links a team member's User account to their Person record
- `linkPersonToUser(personId, userId)` server action in `src/app/(app)/people/[personId]/actions.ts` — candidate/CM only; verifies userId is an active campaign member; checks no other person already linked to that userId in this campaign; sets `person.userId`
- `unlinkPersonFromUser(personId)` — candidate/CM only; sets `person.userId = null`
- `TeamLinkButton` client component in `src/app/(app)/people/[personId]/team-link-button.tsx`: shows violet "Team · [Role]" badge + Unlink button when linked; shows dashed "Link to team member" button that opens inline dropdown of available (unlinked) team members when not linked; uses `useTransition` + `router.refresh()`
- Available members query uses two-step pattern to avoid Prisma back-relation filter limitation: first fetch `db.person.findMany` for `linkedUserIds`, then `db.campaignMembership.findMany` with `userId: { notIn: linkedUserIds }`
- `TeamLinkButton` rendered in person detail Contact card for candidate/CM when person is not anonymized

### All People List — Team Badge
- Team badge in `/people` list now uses `person.userId !== null` instead of `person.listSource === "team"` — more accurate
- Shows `Team · [role label]` using `ROLE_LABELS` from `@/types` when membership role is available
- `getPeopleList` select in `src/lib/people.ts` includes `userId: true` and nested `user.memberships` join filtered by `campaignId`

### General Settings Save Feedback
- `saveGeneralSettings` action in `src/app/(app)/campaign-settings/general/actions.ts` converted from `void` to `(prev, formData) => GeneralSettingsState` signature for use with `useActionState`
- Returns `{ success: true }` or `{ error: "..." }`; wrapped in try/catch
- `GeneralSettingsForm` client component in `src/app/(app)/campaign-settings/general/general-settings-form.tsx` — uses `useActionState`, shows green "Settings saved." banner on success, red error on failure, button shows "Saving…" and is disabled while pending
- `/campaign-settings/general/page.tsx` replaced inline form with `<GeneralSettingsForm>`

### Duplicate Team Member Fix
- `addTeamMember` in `src/app/(app)/team/actions.ts` previously always created a new Person record if no existing Person had `userId = user.id`
- Fix: before creating, check for an existing Person by email (`userId: null, email: normalizedEmail`) and update it (set userId, listSource=team) instead of creating a duplicate
- Lookup order: by userId first (covers re-add after remove), then by email (covers imported voter matching a new team member)

### Person Detail Enhancements
- Contact dropdown — call/SMS/email options in one menu (phone home, phone mobile, email)
- Last contacted indicator — most recent outreach log channel + date shown in contact card
- Navigate button — opens Google Maps walking directions to person's address
- Phone and SMS links with MessageSquare icon for quick access

### Voter ID Matching
- `voterId` field on Person (unique per campaign) — set on OVL import
- Reimport matches by voterId first, then falls back to name+address matching; merges non-blank fields, preserves existing data
- Import summary shows matched/created/updated/skipped counts

---

## Key Files
```
/prisma/schema.prisma, seed.ts
/src/app/(auth)/login, register, verify-email, resend-verification, reset-password
/src/app/(app)/
  dashboard, people, voter-import, canvassing, follow-ups
  outreach, donors, volunteers, team, signs, campaigns, account, address-changes
  analytics/
  events/, events/new/, events/[eventId]/
  field-messages/
  people/map/
  campaign-settings/ward, competitors, script, custom-fields, tags, surveys/, privacy/, reports/, branding/
  voter-import/review
  people/[personId]/out-of-district-actions.ts, out-of-district-control.tsx
  people/[personId]/signature-section.tsx, signature-actions.ts
  people/[personId]/anonymize-button.tsx, anonymize-actions.ts
  people/[personId]/team-link-button.tsx (link/unlink person ↔ team member)
  people/duplicates/actions.ts (configurable dedup + merge)
  people/duplicates/duplicates-ui.tsx (field selector, group cards, merge modal)
  people/duplicates/page.tsx
  campaign-settings/general/general-settings-form.tsx (useActionState form wrapper)
  people/classify-banner.tsx (thin re-export wrapper)
  people/out-of-district/pending/page.tsx, queue-row.tsx
  people/residents/page.tsx, filters-client.tsx
  people/team/page.tsx
  people/voters/page.tsx
  team/actions.ts (team server actions — add, remove, restore, list members)
  team/classify-actions.ts, team/classify-modal.tsx (thin re-exports)
/src/app/admin/campaigns, users, audit-log, export, demo-leads, settings
/src/app/onboarding/choose-plan, create-campaign
/src/app/api/cron/daily-summary/route.ts
/src/app/api/dashboard/canvass-activity/route.ts
/src/app/api/addresses/search/route.ts
/src/lib/
  auth.ts, db.ts, permissions.ts, sanitize.ts, rate-limit.ts
  people.ts, canvassing.ts, outreach.ts, activity.ts, dashboard.ts
  geocoding.ts, ward.ts, address-normalize.ts, competitors.ts
  email.ts, audit.ts, terms.ts, plan-limits.ts, offline-queue.ts
  format-poll-number.ts, classify-actions.ts
  analytics.ts, events.ts, field-messages.ts, map.ts, reports.ts, surveys.ts
/src/components/classify-modal.tsx (shared classify modal — used by people/ and team/ re-exports)
/src/components/layout/sidebar.tsx, mobile-nav.tsx
/src/components/ui/tag-picker.tsx, address-picker.tsx
/src/components/field-messages-banner.tsx
/src/components/dashboard/canvass-activity-feed.tsx
/src/hooks/useOfflineSync.ts
/public/sw.js
/scripts/geocode-demo.ts, export-geocoded-coords.ts, stamp-sw.mjs
/src/app/(app)/people/new/
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

**April 27, 2026 (Batch 9)** — Major feature deployment. 11 new migrations applied (`20260427000002` through `20260427000012`): removed canvass response unique constraint, added sort_order to canvass list entries, added daily summary email toggle, added canvass list status + dynamic filter fields, added voter_id to persons, added appointment task type, added events and event attendees tables, added field messages table, added surveys + survey questions + survey responses + signature records tables, added anonymizedAt to persons and dataRetentionMonths to campaigns. No data loss. CRON_SECRET env var added to production. 7am daily summary cron configured on VPS.

**April 28, 2026 (Batch 10)** — 1 migration applied (`20260428000001_add_fundraising_goal`): added fundraisingGoal (Int?) to Campaign. Configurable duplicate finder, person–team-member linking, team badge using userId+role, General Settings save feedback, and duplicate team member fix deployed.

**April 29, 2026 (Batch 11)** — Import & Data Management hub + voter-list expansion + team CSV/XLSX import + review UX overhaul. No schema migrations. New dependency: exceljs ^4.4.0.
- Voter-list import expanded to capture supportLevel, tags, notes, gender, voter ID, and confirmedVoter status. Row cap raised to 10,000 (was 2,000). XLSX template alongside CSV.
- Smart address parser (`src/lib/address-parser.ts`) handles common Canadian address formats — hyphen-prefix unit numbers, letter-prefix units, comma-separated, trailing annotation suffixes. Combined "Address" column auto-split into StreetNumber/StreetName/UnitNumber.
- Review screen redesigned with four collapsible groups (Ready, Importable but incomplete, Possible duplicates, Missing required). Per-row "Missing: \<fields\>" annotation on status badge. "Export rows to fix" modal auto-skips to direct download when only one group has content.
- supportBadge feature: People list, Person detail, and Walk list views show a support-level badge. Imported support shows with a DASHED border; canvass-derived support shows with a SOLID border. Pure UI feature — no schema change.
- `/import` hub: card-based landing for all bulk-data ops. Permission-aware (managers see all cards; field organizers see only Team members). Old `/voter-import` URLs 307-redirect to `/import/voters` for backward compatibility.
- Team CSV/XLSX import at `/import/team`. Permission gate: candidate, campaign_manager, co_chair, field_organizer. Field organizers can only add canvasser and sign_installer roles. Multi-layer sample-row protection (warning row + sample emails detected). XLSX template with permission-aware role dropdown. Row cap 1,000.
- Onboarding tag colors aligned with `prisma/seed.ts` — newly-created campaigns now get 8 starter tags with the same colors as the seed.
- Voter-list classifier: phone fields are now permanently optional. Different rule from team import (which still requires at least one phone). See Business Rules section.
- `BackLink` client component (`src/components/ui/back-link.tsx`): uses `router.back()` with fallback href. Replaces static `<Link>` back-buttons on all import and duplicate pages.

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
| Activity timeline on person detail | April 27, 2026 |
| Navigate buttons + phone/SMS links on canvassing screen and person detail | April 27, 2026 |
| Canvasser self-stats dashboard (doors knocked, today, signs, volunteers, follow-ups) | April 27, 2026 |
| Printable walk lists (browser print-to-PDF with @media print CSS) | April 27, 2026 |
| Back button on canvassing screen | April 27, 2026 |
| Canvasser performance leaderboard on manager dashboard | April 27, 2026 |
| Live activity feed with 30-second auto-refresh | April 27, 2026 |
| Campaign contact map at /people/map (Mapbox GL JS, color-coded by support level, filters, ward boundary overlay, GeoJSON import) | April 27, 2026 |
| Pin drop contact creation with reverse geocoding | April 27, 2026 |
| Multi-visit canvassing (removed unique constraint, 30-second dedup, visit history preserved) | April 27, 2026 |
| Interactive turf cutting at /canvassing/turf (draw polygons, create walk lists from selection, existing turf overlays) | April 27, 2026 |
| Route optimization (nearest-neighbor Haversine heuristic, reorders walk list entries) | April 27, 2026 |
| Walk time estimates on canvassing screen (~X min walk to next, last stop indicator) | April 27, 2026 |
| Next stop navigation (Google Maps walking directions) | April 27, 2026 |
| Analytics dashboard at /analytics (4 Recharts charts: support trend, doors per day, canvasser performance, support distribution) | April 27, 2026 |
| Scheduled daily email reports (campaign setting toggle, /api/cron/daily-summary, 7am cron on VPS) | April 27, 2026 |
| Dynamic walk lists (auto-updating based on filter criteria, live match count during creation) | April 27, 2026 |
| Walk list approval workflow (field organizer lists need manager approval, pending/active/draft/archived statuses) | April 27, 2026 |
| Walk list archive/delete/edit (soft delete if no responses, archive for lists with data, edit name and entries) | April 27, 2026 |
| Building/apartment grouping (multi-unit addresses grouped on walk list and canvassing screen, numeric unit sort) | April 27, 2026 |
| Voter ID matching on import (match by voterId, merge non-blank fields, import summary) | April 27, 2026 |
| Campaign events system at /events (create events, link to walk lists, attendee management, check-in/check-out) | April 27, 2026 |
| Appointment scheduling from canvassing screen (date/time picker, creates appointment task, badge on canvassing screen) | April 27, 2026 |
| Field messaging at /field-messages (managers push notes to canvassers, urgent/normal priority, dismissible banners, expiry) | April 27, 2026 |
| Contact dropdown on person detail (call/SMS/email in one menu) | April 27, 2026 |
| Last contacted indicator on person detail | April 27, 2026 |
| Survey builder at /campaign-settings/surveys (5 question types, reorder, required fields, preview) | April 27, 2026 |
| Survey integration on canvassing screen (collapsible, answers saved with canvass response) | April 27, 2026 |
| Digital signature capture (canvas-based pad, purpose selection, thumbnails on person detail) | April 27, 2026 |
| Privacy dashboard at /campaign-settings/privacy (data counts, retention settings, consent log) | April 27, 2026 |
| Data anonymization (one-click anonymize person, clears PII, preserves canvass data, badge + edit lock) | April 27, 2026 |
| Configurable duplicate finder at /people/duplicates — user-selected match fields, group cards, merge modal with per-field selection, full record transfer | April 28, 2026 |
| Person–team-member linking — link/unlink any Person to a User via userId, TeamLinkButton on person detail (candidate/CM only) | April 28, 2026 |
| Team badge in All People list uses userId+role (not listSource) — shows "Team · [Role]" | April 28, 2026 |
| General Settings save feedback — useActionState, green success banner, red error, Saving… button state | April 28, 2026 |
| Duplicate team member fix — addTeamMember now checks for existing Person by email before creating a new record | April 28, 2026 |
| Fundraising goal campaign field — fundraisingGoal (Int?) added to Campaign model, shown/edited in General Settings | April 28, 2026 |
| Import & Data Management hub at /import — card-based, permission-aware (managers see all cards; FO sees team only). Old /voter-import URLs redirect to /import/voters | April 29, 2026 |
| Voter-list import expansion — captures supportLevel, tags, notes, gender, voterId, isConfirmedVoter; row cap raised to 10,000; XLSX template alongside CSV | April 29, 2026 |
| Smart address parser (src/lib/address-parser.ts) — Canadian formats, combined "Address" column auto-split into StreetNumber/StreetName/UnitNumber | April 29, 2026 |
| Review screen redesign — four collapsible groups, per-row "Missing: \<fields\>" badge annotation, "Export rows to fix" modal (auto-skips to direct download when only one group has content) | April 29, 2026 |
| supportBadge feature — dashed border for imported support level, solid border for canvass-derived. No schema change | April 29, 2026 |
| Team CSV/XLSX import at /import/team — FO-gated, sample-row protection, XLSX template with permission-aware role dropdown, row cap 1,000 | April 29, 2026 |
| Onboarding tag colors aligned with seed.ts — 8 starter tags with correct colors/order on new campaign creation | April 29, 2026 |
| Voter-list classifier — phone fields permanently optional (different rule from team import which still requires phone) | April 29, 2026 |
| BackLink client component — router.back() with fallback href; replaces static back-links on all import and duplicate pages | April 29, 2026 |

### High Priority
| Item | Effort |
|---|---|
| PWA manifest and install prompt — SW cache busting shipped; manifest and install prompt still needed | Small |

### Medium Priority
| Item | Effort |
|---|---|
| CSV splitter + multi-batch session UI (Prompt C) — client-side splitter for >10k row imports, batches of ~9k rows, session at /import/voters/sessions/[id] with progress tracking. Currently the row cap rejects oversized files — splitter would offer to chunk automatically | Medium — ~5.5h est. |
| Stripe payment integration | Medium — dev tier selector done, Stripe wiring remaining |
| Two-factor authentication (2FA) | Medium |
| UI/layout polish pass | Medium |
| Official voter list reconciliation engine — address normalization, fuzzy name matching, field-level merge, manual review, audit trail | Large |

### Low Priority
| Item | Effort |
|---|---|
| jszip to package.json (KMZ upload prod support) | Small |
| Automated PostgreSQL backups (Backblaze B2 + rclone) | Small |

### Active / In Progress
| Item | Status |
|---|---|
| Demo instance isolation (unique DB per visitor) | Large, deferred |
| Update HANDOFF.md each session | Ongoing |
| Team form address fields (test gate A) — address fields added to manual team-add form in src/app/(app)/team/page.tsx; verify that adding a team member with address fields populated correctly links Person → Household → Address. Code review only, no new code expected | Needs manual verification |
| BackLink router.back() — verify it works in all entry-path scenarios (direct URL load, hub → page, other page → import page) | Needs manual verification |
| Export modal single-group auto-collapse — verify with mixed test data that direct-download fires correctly and the modal still appears for 2+ groups | Needs manual verification |

---

## Roadmap
1. Stripe payment integration
2. Two-factor authentication (2FA)
3. Simple automation rules (soft yes → auto follow-up)
4. Public volunteer signup / petition pages → feeds CRM
5. Automated PostgreSQL backups
6. Demo instance isolation

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
