# LocalSeat.io — Handoff Notes

_Last updated: May 5, 2026 — Batch 16: Street walk canvassing, leads management + bulk delete, Stripe live mode, marketing site comparison modal, contact form delete, admin improvements._

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
- **Payments:** Stripe (live mode — payments active as of May 4, 2026)
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
NEXT_PUBLIC_STRIPE_ENABLED="true"           # live mode — payments active
STRIPE_SECRET_KEY="sk_live_..."             # live secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."  # live publishable key
STRIPE_WEBHOOK_SECRET="whsec_03fLlyEglpn8E0NMWCywZJy952Ckbdsa"
MAINTENANCE_MODE="false"    # Set to "true" for hard maintenance lockout (no DB needed)
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
| starter.candidate@example.com | candidate (Bench plan test campaign) |
| starter.canvasser@example.com | canvasser (Bench plan test campaign) |

After any reseed: sign out and back in to refresh JWT.

Seed creates 8 default tags per campaign: Volunteer, Donor, Endorser, Sign location, Do not contact, Media, VIP, Influencer.

---

## Role Hierarchy
```
Candidate
  └── Campaign Manager
        └── Data Manager
        └── Co-Chair
              └── Field Organizer
                    └── Canvasser
                    └── Volunteer Coordinator
                    └── Finance Lead
                    └── Sign Installer
```

**Role permissions summary:**
- candidate + campaign_manager: full access
- data_manager: broad data access — edit people, manage imports, delete events, manage campaign settings; not in co_chair hierarchy
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
20260430000001_add_signature_consent_types
20260430000002_canvass_language_barrier_and_outcome_detail
20260430000003_add_data_manager_role
20260430000004_event_series_advance_voting
20260501000001_add_campaign_override_snapshot_and_feature_fields
20260501000002_add_support_access_grants
20260502000001_add_feature_overrides
20260502000002_tier_rename
20260503000001_add_promo_codes
```

---

## Key Models
- Campaign, User, CampaignMembership, AuditLog, PlatformSettings
- CampaignOverride (per-campaign limit/feature overrides + snapshot-at-signup values; 16 feature flags + numeric limits; "best of snapshot vs current" enforcement)
- Person, Household, Address, Tag, Note, Task
- CanvassList, CanvassListEntry, CanvassAssignment, CanvassResponse
- OutreachLog, DonorRecord, VolunteerRecord, VolunteerShift
- VotingRecord (ElectionType: federal/provincial/municipal)
- ListImport, PersonListMembership (list import tracking)
- Sign (SignStatus: to_be_installed/installed; SignLocationType: residential/non_residential)
- CampaignCompetitor, AddressChangeRequest, ContactSubmission
- Event, EventAttendee (EventType: campaign_event/fundraiser/town_hall/debate/canvass_kickoff/volunteer_training/other; EventStatus: upcoming/in_progress/completed/cancelled; seriesId String? links recurring series)
- FieldMessage (FieldMessagePriority: normal/urgent)
- Survey, SurveyQuestion (SurveyQuestionType: text/single_choice/multi_choice/rating/yes_no), SurveyResponse
- SignatureRecord
- SupportAccessGrant (lifecycle: requested → approved/denied → expired/revoked; 72h expiry from approval)
- SignatureConsent, SignatureConsentType
- PromoCode (code, referrerName, referrerEmail, discountPercent, stripeCouponId?, isActive, maxUses?, usageCount, totalRevenue, totalDiscounts)

**Key enums:**
- Role: candidate, campaign_manager, data_manager, co_chair, field_organizer, canvasser, volunteer_coordinator, finance_lead, sign_installer
- PlatformRole (on User): super_user, super_admin
- ListImportType: list, telephone_list, official_voters_list
- PersonListMembershipStatus: matched, created, pending_review, accepted
- SignStatus: to_be_installed, installed
- TaskType: includes volunteer_follow_up, appointment
- CanvassListStatus: draft, pending_approval, active, archived
- ListSource: voters_list, residents_list, manual, canvass, team
- SupportLevel enum: strong_yes, soft_yes, undecided, soft_no, strong_no (on both Person and CanvassResponse)
- OutOfDistrictApprovalStatus: not_required, pending, approved, rejected
- PlanTier: bench, chair, podium, stage, arena, demo

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
- advanceVotingDates (DateTime[]) — list of advance poll open datetimes; sorted ascending on save; add/remove in General Settings
- plan (PlanTier, default bench) — determines feature access
- planActivated (Boolean) — false = fully unlocked (pre-payment)
- amountPaid (Int?) — locked at purchase time
- planLockedAt (DateTime?) — when plan was selected
- promoCodeId (String?, FK→PromoCode) — set at checkout when a promo code is applied

---

## Plan Tier System

### Pricing
- Five tiers: Bench, Chair, Podium *(most popular)*, Stage, Arena
- Pricing managed via PlatformSettings keys: `{tier}_regular_price`, `{tier}_sale_price`, `{tier}_label`
- Public API: `GET /api/pricing` — returns all tiers with prices, limits, and features (no auth, 5min cache, CORS open)
- Marketing site fetches from `/api/pricing` on page load and updates pricing cards dynamically
- Onboarding plan cards show strikethrough pricing when sale price differs from regular price; single row of 5 cards on `lg:` breakpoint (`max-w-7xl` container)
- Admin panel at `/admin/settings` controls all pricing, limits, and feature toggles
- Migration `20260502000002_tier_rename` renamed the enum values from starter/campaign/election → bench/chair/podium/stage/arena and applied a data migration (existing `starter` campaigns → `bench`, `campaign` → `podium`, `election` → `arena`)

### Feature Gating (16 toggles)
All controlled via PlatformSettings keys `{tier}_feature_{key}`:

| Feature | Key | Bench | Chair | Podium | Stage | Arena |
|---|---|---|---|---|---|---|
| Donor tracking | donor_tracking | ✗ | ✗ | ✓ | ✓ | ✓ |
| Follow-up queue | follow_up_queue | ✗ | ✓ | ✓ | ✓ | ✓ |
| Analytics | analytics | ✗ | ✗ | ✓ | ✓ | ✓ |
| Volunteer coordination | volunteer_coordination | ✗ | ✗ | ✓ | ✓ | ✓ |
| Finance Lead access | finance_lead_access | ✗ | ✗ | ✓ | ✓ | ✓ |
| Co-Chair seats | co_chair_seats | ✗ | ✗ | ✓ | ✓ | ✓ |
| Unlimited canvassers | unlimited_canvassers | ✗ | ✓ | ✓ | ✓ | ✓ |
| Unlimited constituents | unlimited_constituents | ✗ | ✗ | ✗ | ✓ | ✓ |
| Events | events | ✗ | ✓ | ✓ | ✓ | ✓ |
| Surveys | surveys | ✗ | ✗ | ✗ | ✓ | ✓ |
| Digital signatures | digital_signatures | ✗ | ✗ | ✗ | ✓ | ✓ |
| Custom fields | custom_fields | ✗ | ✓ | ✓ | ✓ | ✓ |
| Sign tracking | sign_tracking | ✗ | ✓ | ✓ | ✓ | ✓ |
| Contact map | contact_map | ✗ | ✗ | ✓ | ✓ | ✓ |
| Reports | reports | ✗ | ✓ | ✓ | ✓ | ✓ |
| Canvass script | canvass_script | ✗ | ✓ | ✓ | ✓ | ✓ |

### Enforcement layers
1. **Sidebar** — gated nav items hidden when feature disabled
2. **Page-level** — gated pages show upgrade card (not redirect) with feature description, pricing breakdown, and upgrade button
3. **Server actions** — write actions return error if feature disabled
4. **API routes** — donor export returns 403 if donor tracking disabled

### Snapshot at signup
- When a campaign selects a plan, all current PlatformSettings limits and features are copied to CampaignOverride as snapshot fields
- `getEffectiveLimits()` uses "best of snapshot vs current" logic: features can only improve, never get worse
- Manual per-campaign overrides (set via admin panel) have highest priority
- Priority chain: manual override → best(snapshot, current global) → hardcoded fallback

### Upgrade cards
- `src/components/upgrade-card.tsx` — server component, queries campaign's amountPaid and target plan's current price
- Shows: feature name, description, "You paid $X. {Plan} plan: $Y. Upgrade cost: $Z."
- Feature metadata in `src/lib/feature-metadata.ts`
- Upgrade button links to `/onboarding/choose-plan`

### Numeric limits
- Bench: 5,000 constituents, 3 canvassers, 1 campaign manager, 1 field organizer
- Chair: 10,000 constituents, unlimited canvassers/managers/FOs
- Podium: 20,000 constituents, unlimited canvassers/managers/FOs, 2 co-chairs
- Stage: 40,000 constituents, unlimited all roles
- Arena: all unlimited
- Constituent usage indicator shown in sidebar for plans with finite limits

### Production deployment notes
- After new migrations, PlatformSettings keys must be inserted into production DB manually (seed only runs on reset)
- Use `psql` via SSH: table is `platform_settings` (snake_case), requires `id` (gen_random_uuid()::text), `key`, `value`, `"updatedAt"` (now())
- Old keys (`starter_price`, etc.) have been removed — new format is `{tier}_regular_price` / `{tier}_sale_price`
- Old tier keys (`starter_feature_*`, `campaign_feature_*`, `election_feature_*`) must also be renamed to `bench_feature_*`, `chair_feature_*`, etc. when applying `tier_rename` migration to production

---

## Stripe Integration

### Status
**Live mode — payments active as of May 4, 2026.**
- `NEXT_PUBLIC_STRIPE_ENABLED=true` on production
- Live keys and live webhook in production `.env`
- Webhook signing secret: `whsec_03fLlyEglpn8E0NMWCywZJy952Ckbdsa`

### How it works
1. User registers → creates campaign (`planActivated: false`)
2. Layout gate redirects unpaid campaigns to `/onboarding/choose-plan`
3. User selects a plan → app creates a Stripe Checkout Session with dynamic pricing from PlatformSettings
4. User pays on Stripe's hosted checkout page
5. Stripe webhook (`checkout.session.completed`) fires → app activates campaign, snapshots limits/features, sets amountPaid
6. User redirected to success page → session refreshed → dashboard accessible

### Dynamic pricing
- No pre-created Stripe prices — amount is set at checkout time from `{tier}_sale_price` (or `{tier}_regular_price` if no sale)
- Five Stripe products (same product IDs in both test and live mode): Bench `prod_UREJUkGMu182BI`, Chair `prod_URELmxFyywN5r7`, Podium `prod_URELAaHM1dfYNA`, Stage `prod_US3T7yDLS1Y5Df`, Arena `prod_US3U6mI3azdBdZ`
- Product IDs in `src/lib/stripe.ts` as `STRIPE_PRODUCTS` map

### Upgrades
- Upgrade cost = target plan price − amountPaid (campaigns pay the difference only)
- Webhook handles both fresh purchases and upgrades
- `buildPlanSnapshot` shared between dev mode (`selectPlanDev`) and webhook

### Key files
- `src/lib/stripe.ts` — Stripe client + product ID mapping
- `src/app/api/stripe/checkout/route.ts` — creates Checkout Session (auth required)
- `src/app/api/stripe/webhook/route.ts` — handles `checkout.session.completed` (no auth, signature verified)
- `src/app/onboarding/choose-plan/success/page.tsx` — post-payment success page
- `src/app/onboarding/choose-plan/plan-cards.tsx` — unified button (Stripe or dev mode)
- `src/app/onboarding/choose-plan/actions.ts` — `buildPlanSnapshot` extracted as shared function

### Payment gate
- New campaigns created with `planActivated: false`
- `src/app/(app)/layout.tsx` redirects unpaid campaigns to `/onboarding/choose-plan` when `NEXT_PUBLIC_STRIPE_ENABLED=true`
- Dev mode (`NEXT_PUBLIC_STRIPE_ENABLED=false`): `selectPlanDev` activates instantly, no payment
- Demo campaigns bypass the gate
- Super_users in support mode bypass the gate

### Environment variables (production)
```
STRIPE_SECRET_KEY=sk_live_...                     # live secret key (active)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...    # live publishable key (active)
STRIPE_WEBHOOK_SECRET=whsec_03fLlyEglpn8E0NMWCywZJy952Ckbdsa  # live webhook signing secret
NEXT_PUBLIC_STRIPE_ENABLED=true                   # payments live
```

Local dev (`.env`):
```
NEXT_PUBLIC_STRIPE_ENABLED=false   # keeps dev in instant-activate mode
```

### Webhook
- Endpoint: `https://app.localseat.io/api/stripe/webhook`
- Events: `checkout.session.completed`
- Configured in Stripe dashboard (live mode)
- Signing secret in production `.env`
- Route added to proxy public paths and maintenance-exempt paths

### Go-live checklist — COMPLETED May 4, 2026
1. ✅ Got live keys from Stripe dashboard (`sk_live_...`, `pk_live_...`)
2. ✅ Verified product IDs are same in test and live — no code change needed
3. ✅ Created webhook endpoint in live mode → `https://app.localseat.io/api/stripe/webhook` → got signing secret
4. ✅ Updated production `.env` with live keys and webhook secret
5. ✅ Set `NEXT_PUBLIC_STRIPE_ENABLED=true` in production `.env`
6. ✅ Deployed and verified webhook fires, campaign activates, dashboard accessible

---

## Promo Codes

### Purpose
Affiliate/referral promo codes that apply a percentage discount at Stripe Checkout. Managed via admin panel at `/admin/promo-codes`.

### Model (PromoCode)
- `code` (String, unique, uppercase) — user-facing code (e.g. LAUNCH2026)
- `referrerName`, `referrerEmail` — for tracking/payouts
- `discountPercent` (Int) — 1–100; used to create a Stripe coupon on first use
- `stripeCouponId` (String?, nullable) — lazily created in Stripe the first time a code is validated; reused on subsequent uses
- `isActive` (Boolean, default true) — inactive codes are rejected at validation
- `maxUses` (Int?, nullable) — null = unlimited
- `usageCount` (Int, default 0) — incremented by webhook on successful payment
- `totalRevenue` (Int, default 0) — cumulative amountPaid (cents)
- `totalDiscounts` (Int, default 0) — cumulative discountAmount (cents)
- Campaign has `promoCodeId` (String?, FK→PromoCode) — set at checkout; one-to-many (one code can apply to many campaigns)

### How it works
1. User enters code on plan selection screen → `GET /api/promo/validate?code=X&tier=bench` validates and returns `{ discountPercent, promoCodeId }`
2. Code is passed to `/api/stripe/checkout` → checkout route creates Stripe PromotionCode on first use (lazily), attaches to CheckoutSession via `discounts: [{ promotion_code: pmid }]`
3. Stripe Checkout applies discount on Stripe's side (user sees discounted price)
4. Webhook (`checkout.session.completed`) reads `session.metadata.promoCodeId`, computes `discountDollars = amount_subtotal − amount_total`, updates `promoCode.usageCount + 1`, `totalRevenue`, `totalDiscounts`; sets `campaign.promoCodeId`

### Stripe SDK v22 note
`promotionCodes.create` shape changed in SDK v22: `coupon` moved into `promotion: { type: "coupon", coupon: id }` at top level. This is already handled in `src/lib/promo-codes.ts`.

### Key files
- `src/lib/promo-codes.ts` — `validatePromoCode()`, `getOrCreateStripeCoupon()`
- `src/app/api/promo/validate/route.ts` — public GET endpoint (no auth), rate-limit safe
- `src/app/admin/promo-codes/page.tsx` — list with usage stats
- `src/app/admin/promo-codes/[codeId]/page.tsx` — detail + edit
- `src/app/admin/promo-codes/actions.ts` — create, update, toggle active
- `src/app/onboarding/choose-plan/plan-cards.tsx` — promo code input UI, shows discount applied
- `src/app/api/stripe/checkout/route.ts` — accepts `promoCode` in request body, attaches to session

### Seed
`LAUNCH2026` — 5% discount, referrer: Test Referrer / referrer@example.com, no max uses, no Stripe coupon (created lazily). Added at end of `prisma/seed.ts`.

---

## Street Walk Canvassing

A walk-list-free canvassing mode for canvassing streets not yet in the system. Available to all plan tiers.

### Route
`/canvassing/street-walk` — accessible to canvasser, field_organizer, campaign_manager, candidate, data_manager.

### Two-phase flow
**Phase 1 — Street context setup:** canvasser enters street name, city, province, and optional postal prefix. City/province pre-filled from campaign municipality/province fields. Tapping "Start canvassing →" locks the context and advances to Phase 2.

**Phase 2 — Rapid door entry:**
1. Canvasser types a house number → taps "Check address"
2. Server checks if address exists in the campaign DB (exact match on streetNumber + city, fuzzy match on normalized street name)
3. If address exists: shows existing residents' names and support level buttons per person
4. If address is new: shows a blank "new person" form with name inputs + support level buttons
5. Canvasser records support levels, sign/volunteer/donor interest, and notes
6. "Save and next →" creates/updates all records and clears house number for the next door

### What gets created on save
- **Address** — created if not found; `wardStatus: not_checked`, no geocoding during street walk
- **Household** — one per address
- **Person** — created for each new person entered; `listSource: canvass`, `includeInWalkLists: true`, `field-entry` tag applied (silently skipped if tag not found)
- **CanvassResponse** — created when a support level is set; updates `Person.supportLevel`
- **OutreachLog** — one per person per save
- Duplicate prevention: checks first+last name (case-insensitive) at same address before creating

### System list pattern
Street walk requires a non-null `assignmentId` on `CanvassResponse`. Solved by:
- Lazy-creating a "Street Walk (System)" `CanvassList` per campaign (only once)
- Lazy-creating one `CanvassAssignment` per canvasser per campaign (reused across sessions)
- All street-walk responses are linked to this assignment for data consistency

### Street name normalization
`normalizeStreetName()` strips common suffix words (street/st/avenue/ave/road/rd/drive/dr/boulevard/blvd/crescent/cres/court/ct/place/pl/lane/ln/way/wy) before fuzzy comparison. The original typed value is stored verbatim.

### Key files
- `src/app/(app)/canvassing/street-walk/actions.ts` — `checkAddress()` and `saveStreetWalkEntry()` server actions
- `src/app/(app)/canvassing/street-walk/page.tsx` — server component with session + role check
- `src/app/(app)/canvassing/street-walk/street-walk-screen.tsx` — client component, two-phase UI
- `src/app/(app)/canvassing/page.tsx` — Street Walk card added to canvasser and manager views

---

## Leads Management

### Admin leads page at `/admin/demo-leads`
Unified view of all inbound leads: marketing site demo registrations and abandoned app signups. Accessible to super_user and super_admin only. Renamed from "Demo Leads" → "Leads" throughout sidebar, admin index card, and page title.

### Two sources
- **Demo** — marketing site demo registration form (`demo.localseat.io`)
- **App** — abandoned app registration (user started signup but never completed plan selection)

### Capture mechanism
Both sources write to the `DemoRegistration` table. App registrations are captured in `src/app/(auth)/register/actions.ts` via an upsert (update or insert) on `DemoRegistration` whenever a user completes the registration form, with `source: "app"`. Old records with `source: "app_signup"` are handled by backward-compat logic in the groupBy query.

### Source field normalization
- New records: `source: "app"` (standardized in register action, May 4 2026)
- Old records in DB: `source: "app_signup"` — groupBy logic treats both as `"app"` in output
- No migration needed — `source String?` already existed

### Source pills
- Blue "Demo" pill — marketing site registrations
- Purple "App" pill — abandoned app registrations (both `"app"` and legacy `"app_signup"`)

### Delete functionality
- Inline confirm pattern: trash icon → "Delete? Yes / No" in same table row
- Hard delete (`deleteMany` by email — removes all DemoRegistration rows for that email)
- Restricted to super_user / super_admin
- Audit logged as `DEMO_LEAD_DELETED`
- Contact submissions (`/admin/contact-submissions`) have the same delete pattern (single row by id)

### Key files
- `src/app/admin/demo-leads/actions.ts` — `getDemoLeads`, `markAsEmailed`, `unmarkAsEmailed`, `deleteDemoLead`, `exportDemoLeadsCSV`
- `src/app/admin/demo-leads/leads-client.tsx` — table with inline delete confirm, source pills
- `src/app/admin/demo-leads/page.tsx` — server wrapper
- `src/app/admin/contact-submissions/actions.ts` — `deleteContactSubmission`
- `src/app/admin/contact-submissions/contact-submissions-client.tsx` — detail panel with delete in footer
- `src/components/layout/admin-sidebar.tsx` — nav label "Leads"
- `src/app/admin/page.tsx` — admin index card renamed "Demo & App Signups"

---

## Support Access System

Super_users can view any campaign's data through the normal app UI.

### Two access levels
- **Read-only** — always available, no approval needed. Super_user enters via admin campaign detail page.
- **Full access** — must be requested by super_user, approved by campaign's candidate or campaign_manager. 72-hour expiry from approval.

### Flow
1. Super_user clicks "Request full access" on admin campaign detail page (optional note)
2. Email sent to all candidate/campaign_manager members
3. In-app banner shown to candidate/campaign_manager with approve/deny buttons
4. Campaign approves → 72h clock starts → super_user can enter with full access
5. Access auto-expires, or campaign/super_user can revoke early

### Session management
- JWT fields: `supportMode` ("readonly" | "full" | null), `supportOriginalCampaignId`, `supportCampaignName`
- Dark support banner at top of all pages during support sessions
- `exitSupportMode()` restores original campaign context

### Write protection
- Read-only: `checkSupportWriteAccess()` blocks all writes (34 action functions across 14 files)
- Full access: writes allowed, all audit log entries tagged with `supportAccess: true`
- Audit log page shows amber "Support" badge on support-session entries

### Key files
- `src/lib/support-access.ts` — all business logic
- `src/components/layout/support-banner.tsx` — persistent top banner
- `src/components/layout/support-access-request-banner.tsx` — in-app approval banner
- `src/app/(app)/campaign-settings/support-access/` — campaign-side UI
- `src/app/admin/campaigns/[campaignId]/support-access-card.tsx` — admin-side UI

---

## Maintenance Mode

### Two-layer model
- **ENV `MAINTENANCE_MODE=true`** → proxy blocks all non-exempt requests immediately (synchronous ENV check, no DB, no network call)
- **PlatformSettings `maintenance_mode=true`** → `(app)/layout.tsx` catches authenticated app users; admins and support mode users exempt
- The proxy does NOT fetch `/api/maintenance-status` internally — that caused a 4-minute request cascade (self-referential fetch loop). The route exists for external health checks only.

### Activation
- **ENV var**: `MAINTENANCE_MODE=true` in `.env` — immediate hard lockout, no DB needed (use for deploys)
- **Admin panel**: toggle at `/admin/settings` → saves `maintenance_mode` key to PlatformSettings → layout catches it

### Behavior when active
- All non-admin traffic redirected to `/maintenance` page
- Allowed during maintenance: `/admin/*`, `/api/auth/*`, `/api/pricing`, `/api/maintenance-status`, `/api/stripe/webhook`, static assets
- Maintenance page: branded, "We'll be right back", try-again link, no auth required

### Force logout
- "Force logout all users" button in admin settings
- Runs `UPDATE users SET "sessionVersion" = "sessionVersion" + 1` — invalidates all active sessions
- Separate from maintenance mode — can be used independently
- Typical deploy workflow: maintenance ON → deploy → maintenance OFF → optionally force logout

---

## Email Verification

### Behavior
Email verification is **not** a blocking gate. Users can complete onboarding, select a plan, and access the full app without verifying their email. Verification is encouraged via a persistent banner.

### Banner
- `src/components/layout/email-verification-banner.tsx` — client component
- Shown in `src/app/(app)/layout.tsx` for unverified users who are not platform admins (super_user/super_admin)
- Amber styling days 0–6 after account creation; red/urgent styling day 7+ with "X days left" countdown (14-day deadline)
- "Resend verification email" button calls `resendVerificationEmail(email)` server action directly
- "Email sent!" confirmation fades after 5 seconds
- `dismissed` state hides the banner per-session (client-only, resets on next login)

### Session
- `emailVerified` is exposed on the NextAuth session type (`src/lib/auth.ts`) via both the token callback and the session callback
- Layout fetches `user.createdAt` from DB only for unverified non-admins (one extra query per unverified app load)

### Dev mode
- `SKIP_EMAIL_VERIFICATION=true` in `.env` disables the banner entirely (set on demo instance)
- Verification email sending and the `/verify-email/pending` and `/account-expired` routes are preserved for users who navigate there directly

### What was removed
- The proxy.ts verification gate — 14 lines that redirected unverified users to `/verify-email/pending` — was removed entirely. Users are never blocked by verification status.

---

## Brand

### Logo
- Speech bubble mark with horizontal lines and checkmark accent
- Three variants: full (lines + checkmark), mono (checkmark only), favicon (rounded rect + checkmark)
- Three tones: ink (#1a2b24 bubble), cream (#fbf6e9 bubble), clay (#e8855c bubble)
- Components: `src/components/brand/Logo.tsx`, `src/components/brand/Wordmark.tsx`
- Wordmark: Fraunces 800 italic + clay dot

### Fonts
- Body: Inter (app), DM Sans (marketing site)
- Display: Fraunces italic 800 (wordmark only)
- Marketing headings: Fraunces (was DM Serif Display — updated May 1)

### Colors (unchanged)
- Brand orange: #f97316 (app), #F26522 (marketing site legacy)
- Slate scale: standard Tailwind slate
- Clay accent: #e8855c (logo accent, used sparingly)

### Icons
- public/favicon.ico, favicon.svg, apple-touch-icon.png (180px)
- public/icon-192.png, icon-512.png, icon-512-maskable.png (PWA)
- public/logo.svg, og-image.png (1200×630)

---

## PWA

- Manifest: `public/manifest.json` — standalone, portrait, start_url /dashboard
- Service worker: `public/sw.js` — cache-first static assets, network-first navigation, no API interception
- Cache busting: `scripts/stamp-sw.mjs` stamps CACHE_NAME on every build
- SW registration: global via `src/components/sw-register.tsx` (root layout)
- Install prompt: `src/components/pwa-install-prompt.tsx` — mobile only, 7-day dismissal, iOS share-button guidance
- Apple meta tags in root layout for iOS home screen support

---

## Critical Operational Rules

**Never run `prisma migrate dev` against staging or production.**  
Use `prisma migrate deploy` — non-interactive, no shadow DB, safe for CI and remote:
```powershell
$env:DATABASE_URL='<neon-connection-string>' ; npx prisma migrate deploy
```
`migrate dev` prompts destructively on shared databases and can leave schema in an inconsistent state. Only run `migrate dev` locally against `localseat_dev`.

**Always push both remotes on every deploy.**  
`git push origin main && git push staging main` — forgetting the staging remote leaves Vercel behind silently.

**Each database environment needs migrations applied separately.**  
Local (`localseat_dev`), staging (Neon), demo (`localseat_demo`), and production (`localseat_prod`) are fully independent. After any `prisma migrate dev` locally, run the `migrate deploy` PowerShell command above against Neon before the Vercel deploy auto-triggers. Then SSH into the VPS and run `./deploy.sh` for prod and demo.

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

**`geocodeAndClassifyAddress` — canonical post-create address pipeline**  
Any new manual address entry point (form, action, API handler) must call `geocodeAndClassifyAddress(addressId, campaignId, personId?)` from `src/lib/ward.ts` after creating or updating an Address record. The helper: geocodes with Mapbox if lat/lng are null, runs `isPointInWard` against `campaign.wardBoundary`, sets `wardStatus` + `isOutOfDistrict` on the Person. Skips the Person update for anonymized records. Never throws — all failures are caught and logged. Use `void` (fire-and-forget) for form-save paths to keep UX fast; use `await` only when coords are already cached (pin drop).

**Hybrid address picker**  
`src/components/ui/address-picker.tsx` is the standard manual address input for all new forms. Returns an `AddressPickerResult` discriminated union (`type: "campaign" | "mapbox" | "manual"`). Campaign results include `addressId` (reuse existing address). Mapbox results include `latitude`/`longitude` (thread through to `db.address.create` so the geocode helper skips the redundant Mapbox API call). Manual results have no coordinates. CSV/bulk imports do not use this component — they go through the import pipeline directly.

**Two-row action button layout (walk list detail)**  
Action button containers use an outer `flex flex-col gap-2` with two inner `flex flex-wrap items-center gap-2 justify-end` rows. Row 1 = operational (Canvass, Optimize, Map, Assign). Row 2 = management (Edit, Archive, Print, Export CSV, Delete). `<Link>` and `<a>` have no native `disabled` attribute — when a button must be disabled, conditional-render a `<button type="button" disabled>` with identical styling + `disabled:opacity-50 disabled:cursor-not-allowed` instead of the link. This gives correct semantics (no click, tooltip, focus state) without client-side state.

**Recurring events — generate all occurrences upfront**  
Create every occurrence as an individual `Event` row sharing a `seriesId` UUID at creation time. Do not use a "series definition + lazy generation" model — individual rows are simpler to query, delete, display, and edit independently. `db.event.createMany()` for bulk insert. Max 52 occurrences per series (hard cap in `generateRecurringDates` in `events/actions.ts`). Weekday convention: 0=Mon…6=Sun (JS `getDay()` returns 0=Sun…6=Sat; convert with `const monDay = jsDay === 0 ? 6 : jsDay - 1`).

**Cross-tier role permissions (data_manager)**  
`data_manager` sits between `campaign_manager` and `co_chair` for data-heavy operations (edit people, manage imports, delete events). Permission checks that already allow `candidate` + `campaign_manager` should explicitly enumerate `data_manager` as well — it is not automatically inherited from any other role. Check `canViewAllPeople`, `requireEventManager`, and all settings guards when adding new restricted actions.

**Per-campaign signature consent types**  
`SignatureRecord.purpose` uses a string enum (`lawn_sign_consent`, `volunteer_consent`, `petition`, `other`). Purpose labels are display-only — do not add new enum values to the schema unless a new consent workflow requires server-side branching. New consent contexts can reuse `other` or extend the display labels in the UI layer without a migration.

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

### Audit Log

**Admin audit log** (`/admin/audit-log`):
- Server-side pagination (50/page), URL param filters: `userId` and `campaignId`
- `AuditFilterBar` client component — two `SearchSelect` dropdowns (text input → filtered dropdown, outside-click close, selected shows pill with X); navigates with `useRouter` to `/admin/audit-log?userId=...&campaignId=...&page=1`
- Filter options built from `getFilterOptions()` — up to 500 distinct users and 500 campaigns from audit log rows
- All timestamps formatted as Eastern Time (ET) — `new Date(date).toLocaleString("en-CA", { timeZone: "America/Toronto" })`
- "Support" amber badge on entries where `metadata.supportAccess === true`

**Campaign-level audit log** (`/audit-log`):
- Accessible to `candidate`, `campaign_manager`, `data_manager` only (role-gated)
- Loads up to 200 most recent entries scoped to `activeCampaignId`
- `AuditLogClient` — client-side user filter dropdown, count display, "Showing most recent 200 of N entries" when truncated
- Sidebar nav item: "Audit Log" with document icon, shown for candidate/campaign_manager/data_manager; placed above the Admin collapsible section

**Shared component**: `src/components/audit-log/audit-log-table.tsx`
- `AuditEntry` interface, `formatET()` helper, `AuditLogTable` component
- No "use client" or "use server" directive — works in both server and client trees
- `showCampaign` prop controls optional Campaign column

### Admin Users

- Client-side search by name or email — `UsersClient` in `src/app/admin/users/users-client.tsx`; search input filters across `firstName`, `lastName`, full name concatenation, and `email`; shows "Showing X of Y users" count when filtering
- Platform role badge — inline purple badge next to user's name (`bg-purple-100 text-purple-700`) when `platformRole` is set; removed from dedicated column
- Campaign pills — `CampaignPills` component renders each campaign membership as a linked pill showing campaign name + role label; no separate campaign count column
- Server page simplified to thin wrapper: `src/app/admin/users/page.tsx` queries `memberships` with `campaign { id, name }` and delegates all rendering to `UsersClient`

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
/src/app/(app)/canvassing/street-walk/ (page.tsx, street-walk-screen.tsx, actions.ts)
/src/app/admin/campaigns, users, audit-log, export, demo-leads, contact-submissions, settings, promo-codes
/src/app/onboarding/choose-plan, create-campaign
/src/app/api/cron/daily-summary/route.ts
/src/app/api/dashboard/canvass-activity/route.ts
/src/app/api/addresses/search/route.ts
/src/lib/
  auth.ts, db.ts, permissions.ts, sanitize.ts, rate-limit.ts
  people.ts, canvassing.ts, outreach.ts, activity.ts, dashboard.ts
  geocoding.ts, ward.ts, address-normalize.ts, competitors.ts
  email.ts, audit.ts, terms.ts, plan-limits.ts, offline-queue.ts, promo-codes.ts
  format-poll-number.ts, classify-actions.ts
  analytics.ts, events.ts, field-messages.ts, map.ts, reports.ts, surveys.ts
/src/components/classify-modal.tsx (shared classify modal — used by people/ and team/ re-exports)
/src/components/layout/sidebar.tsx, mobile-nav.tsx, email-verification-banner.tsx
/src/components/audit-log/audit-log-table.tsx (shared AuditEntry interface + AuditLogTable)
/src/app/(app)/audit-log/page.tsx, audit-log-client.tsx
/src/app/admin/audit-log/audit-filter-bar.tsx
/src/app/admin/users/users-client.tsx
/src/app/api/promo/validate/route.ts
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

**April 30, 2026 (Batch 13)** — 2 migrations applied (`20260430000001_add_data_manager_role`, `20260430000004_event_series_advance_voting`): added data_manager Role enum value; added seriesId to events + advanceVotingDates to campaigns. Walk list button layout restructured (two rows, always-rendered, disabled when empty). Events system overhauled: updated EventType/EventStatus enums, copy event modal, recurring event series, advance voting dates in general settings. NewEventForm extracted to client component (useActionState). Vercel EventAttendeeStatus import build error fixed.
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
| Person edit form — address fields always render in edit mode (was gated on existing address); Save creates Address + Household when none existed; empty/whitespace saves silently skipped | April 29, 2026 |
| Address autocomplete API fix — `force-dynamic` added to `/api/addresses/search` route; was statically cached by Next.js, returning 401 for all authenticated requests | April 29, 2026 |
| OOD detection on `/people/new` — geocodes address after create, runs `isPointInWard` against campaign `wardBoundary`, sets `wardStatus: "outside"` + `isOutOfDistrict: true` when outside; wrapped in try/catch so Mapbox failures don't block redirect | April 29, 2026 |
| `/people/out-of-district` empty-state banner — amber banner with link to `/campaign-settings/ward` shown when no ward boundary configured | April 29, 2026 |
| Unified `geocodeAndClassifyAddress` helper in `src/lib/ward.ts` — wired into address edit (create + update branches), pin drop on `/people/map`, `/team` manual add; update branch passes lat/lng from picker (null forces re-geocode); skips Person update for anonymized records | April 29, 2026 |
| Geocoded + ward status badges on person detail header — three ward states (In area / Out of area / Pending review); `outside_accepted` treated as In area; Geocoded badge green when lat/lng present, amber "Not geocoded" when address exists without coords; no badges on anonymized records | April 29, 2026 |
| Team excluded from OOD queue — `listSource: { not: "team" }` filter on both `/people/out-of-district/page.tsx` and `/people/out-of-district/pending/page.tsx`; helper still sets accurate `wardStatus` on team members | April 29, 2026 |
| Hybrid address autocomplete — `/api/addresses/search` returns `{ campaign, mapbox }` with resident counts and server-side dedup; `address-picker.tsx` rewritten with two grouped sections, `AddressPickerResult` discriminated union, AbortController, 300ms debounce, 3-char minimum, session cache; wired into `/people/new`, person detail edit, and `/team` add; Mapbox lat/lng threaded through actions to `db.address.create`; classify-modal updated with `toAddressValue` adapter | April 29, 2026 |
| data_manager role — new Role enum value between campaign_manager and co_chair; has full data access (edit people, manage imports, delete events, manage settings); explicitly enumerated in all permission checks (canViewAllPeople, requireEventManager, settings guards); migration 20260430000001 | April 30, 2026 |
| Walk list detail — two-row action button layout: Row 1 = operational (Canvass this list, Optimize route, View on map, Assign canvasser); Row 2 = management (Edit, Archive, Print, Export CSV, Delete); flex-col outer + flex-wrap inner rows; gap-y-2 for clean wrap at narrow widths | April 30, 2026 |
| Walk list detail — all action buttons always rendered regardless of entry count; Canvass, Optimize, Map, Print, Export CSV disabled (disabled attr + opacity-50 + cursor-not-allowed + tooltip) when list has no entries; Edit, Archive, Assign, Delete always enabled; `<Link>` buttons swap to `<button disabled>` (conditional render) since Link has no native disabled | April 30, 2026 |
| Events EventType updated — campaign_event, town_hall, debate, canvass_kickoff, volunteer_training added; old canvass_event/phone_bank/meeting removed; EventStatus: upcoming replaces scheduled; labels updated in UI | April 30, 2026 |
| Copy event — CopyEventModal on /events/[eventId]: floating trigger button, pre-filled form (name prefixed "Copy of…", date/startTime/endTime/location/type all pre-filled), no attendees copied, redirects to new event detail on success, audit log action "event_copied" with sourceEventId; useTransition + router.push | April 30, 2026 |
| Recurring events — toggle on new event form; weekday multi-select Mon–Sun (0=Mon…6=Sun convention); end after N occurrences (max 52) or by end date (max 1 year from start); generates individual Event rows all sharing a seriesId UUID via db.event.createMany(); redirect to /events on save; audit log action "event_series_created" | April 30, 2026 |
| NewEventForm client component — new event form moved to client component (src/app/(app)/events/new/new-event-form.tsx) using useActionState; createEvent action signature changed to (_prev, formData) to support useActionState; recurring UI state (toggle, weekday checkboxes, endType radios) managed locally | April 30, 2026 |
| Advance voting dates — Campaign.advanceVotingDates DateTime[] field; add/remove section in /campaign-settings/general; date + time inputs per entry; submitted via indexed hidden inputs (advanceDateCount, advanceDate_N, advanceTime_N); sorted ascending on save; loaded sorted on page render | April 30, 2026 |
| Migration 20260430000004_event_series_advance_voting — adds seriesId TEXT (nullable) to events table, events_seriesId_idx index, advanceVotingDates TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[] to campaigns table; applied via prisma migrate deploy (non-interactive) | April 30, 2026 |
| EventAttendeeStatus import fix — removed spurious export type \{ EventAttendeeStatus \} from events/actions.ts that caused Vercel build failure; status type now imported directly from @prisma/client in attendee-panel.tsx | April 30, 2026 |
| Plan tier enforcement — sidebar, page, server action, and API route gating for all plan features | May 1, 2026 |
| Snapshot-at-signup — CampaignOverride stores limits/features/pricing at plan selection time; "best of snapshot vs current" enforcement | May 1, 2026 |
| DB-driven feature toggles — 16 features controlled via PlatformSettings, admin panel editable toggle matrix | May 1, 2026 |
| Dynamic pricing — regular/sale price fields in admin panel, public /api/pricing endpoint, marketing site fetches and updates dynamically | May 1, 2026 |
| Upgrade cards — gated pages show feature description + pricing breakdown instead of redirecting to dashboard | May 1, 2026 |
| Support access system — read-only (always) and full access (72h, request/approve flow) for super_users viewing campaign data | May 1, 2026 |
| Maintenance mode — ENV + DB toggle, /maintenance page, admin panel control, force logout all users | May 1, 2026 |
| 404 handling — global not-found with auth-aware redirect, in-app not-found with sidebar preserved | May 1, 2026 |
| Canvassing support numbers reversed — 5=Yes+ down to 1=No- (display only, data values unchanged) | May 1, 2026 |
| Logo refresh — speech bubble mark + Fraunces italic wordmark across app, marketing site, and PWA icons | May 1, 2026 |
| PWA install prompt — global SW registration, mobile install banner with 7-day dismissal, iOS guidance | May 1, 2026 |
| Starter constituent limit raised to 5,000 (from 2,500) | May 1, 2026 |
| Marketing site pricing/features pulled from /api/pricing — admin panel changes reflect on localseat.io automatically | May 1, 2026 |
| 8 additional feature toggles (events, surveys, signatures, custom fields, signs, map, reports, script) with full enforcement | May 1, 2026 |
| Seed data: Starter test campaign + 2 test users, CampaignOverride snapshots for both campaigns | May 1, 2026 |
| Seed cleanup: signatureConsent, signatureConsentType, supportAccessGrant added to delete order | May 1, 2026 |
| Proxy fix: /api/pricing added to public paths, /api/* routes skip admin redirect | May 1, 2026 |
| Migration fix: support_access_grants column names corrected from snake_case to camelCase | May 1, 2026 |
| Stripe Checkout integration — dynamic pricing from PlatformSettings, webhook activation, upgrade support (pay the difference) | May 1, 2026 |
| Payment gate — new campaigns start with planActivated=false, layout redirects to plan selection until paid | May 1, 2026 |
| Maintenance mode fix — removed self-referential fetch from proxy, two-layer model (ENV for proxy, DB for layout) | May 1, 2026 |
| advanceVotingDates fix — explicit empty array on campaign creation to avoid null constraint | May 1, 2026 |
| Proxy support mode bypass — super_users with supportMode set can access regular app routes | May 1, 2026 |
| 5-tier plan restructure — PlanTier enum renamed bench/chair/podium/stage/arena; migration `20260502000002_tier_rename` applies data migration; existing starter→bench, campaign→podium, election→arena | May 2, 2026 |
| Plan cards single-row layout — `/onboarding/choose-plan` plan-cards.tsx: 5-card single-row grid (`lg:grid-cols-5`, `max-w-7xl`); "Most popular" badge moved to Podium; reduced card padding and price font size | May 2, 2026 |
| Promo codes system — PromoCode model, admin UI at `/admin/promo-codes`, validate API, Stripe coupon lazy creation (SDK v22 shape), webhook usage tracking, plan-cards.tsx discount input; migration `20260503000001_add_promo_codes` | May 3, 2026 |
| LAUNCH2026 seed promo code — 5% discount, no max uses, no Stripe coupon (lazy); added at end of seed.ts | May 3, 2026 |
| Stripe webhook promo tracking — extracts `promoCodeId` from session metadata, computes `discountDollars`, increments `promoCode.usageCount/totalRevenue/totalDiscounts`, sets `campaign.promoCodeId` | May 3, 2026 |
| Email verification moved post-payment — removed proxy.ts blocking gate; persistent amber/red banner in app layout (`email-verification-banner.tsx`); `emailVerified` exposed on session type; banner dismissed per-session; resend button; SKIP_EMAIL_VERIFICATION=true disables banner | May 3, 2026 |
| Campaign audit log at `/audit-log` — candidate/CM/data_manager only; up to 200 entries; client-side user filter dropdown; "Audit Log" sidebar nav item above Admin section; ET timestamps | May 3, 2026 |
| Admin audit log improvements — server-side `userId` + `campaignId` filter dropdowns (`AuditFilterBar`); ET timestamps on all entries; pagination preserves active filters | May 3, 2026 |
| Shared `AuditLogTable` component — `src/components/audit-log/audit-log-table.tsx`; works in server and client trees; `showCampaign` prop; "Support" badge on support-session entries | May 3, 2026 |
| Admin users page — client-side search by name/email; campaign pills (linked names + roles) replace count column; platform role badge inline next to name | May 3, 2026 |
| Tag cap raised to 18 (from 10); custom fields — existing 5-field cap confirmed; limits noted in Key Features | May 3, 2026 |
| Marketing site pricing section — 5-card layout (Bench/Chair/Podium/Stage/Arena); Podium highlighted as most popular; prices fetched from `/api/pricing` dynamically | May 4, 2026 |
| Security headers update — CSP updated for new Mapbox endpoint patterns; Permissions-Policy refined | May 4, 2026 |
| Stripe live mode — switched from test to live keys; `NEXT_PUBLIC_STRIPE_ENABLED=true` on production; live webhook configured with signing secret `whsec_03fLlyEglpn8E0NMWCywZJy952Ckbdsa`; product IDs unchanged (same in test and live) | May 4, 2026 |
| Marketing site comparison modal — feature comparison table modal accessible from pricing cards; mobile-friendly overlay; closes on backdrop click | May 4, 2026 |
| Marketing site footer fixes — consistent link structure, corrected URLs | May 4, 2026 |
| Marketing site about page — dynamic pricing pulled from `/api/pricing`, shown in context of product description | May 4, 2026 |
| Marketing site terms — plan duration and billing language updated to reflect live payments | May 4, 2026 |
| Street walk canvassing at `/canvassing/street-walk` — two-phase mobile UI (street context → door entry); creates Address, Household, Person, CanvassResponse on save; lazy "Street Walk (System)" list + per-canvasser assignment; all plan tiers | May 4, 2026 |
| Street walk card on canvassing hub — added to canvasser view (above empty state) and manager view; amber styling with location pin icon | May 4, 2026 |
| Admin leads page renamed — "Demo Leads" → "Leads" across sidebar nav, admin index card, page title, and description | May 4, 2026 |
| Leads page unified source display — App (purple pill) and Demo (blue pill) source pills in leads table; backward compat for legacy `"app_signup"` records | May 4, 2026 |
| App signup source normalized — register action now writes `source: "app"` (was `"app_signup"`); groupBy logic handles both for backward compat | May 4, 2026 |
| Demo leads delete — inline confirm pattern (trash icon → "Delete? Yes / No"); hard delete by email (`deleteMany`); super_user/super_admin only; audit logged | May 4, 2026 |
| Contact submissions delete — same inline confirm pattern in detail panel footer; hard delete by id; super_user/super_admin only; audit logged | May 4, 2026 |

### High Priority
_(none)_

### Medium Priority
| Item | Effort |
|---|---|
| CSV splitter + multi-batch session UI (Prompt C) — client-side splitter for >10k row imports, batches of ~9k rows, session at /import/voters/sessions/[id] with progress tracking. Currently the row cap rejects oversized files — splitter would offer to chunk automatically | Medium — ~5.5h est. |
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

---

## Roadmap
1. Marketing site redesign (deferred — ship current, revisit after customer feedback)
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
Online donations, mass texting, email broadcasts, predictive scoring, advanced analytics, native apps, social media tools, party integrations, multilingual, custom theming, federal/provincial compliance.

---

## How to Start the Next Session
1. `npm run dev`
2. Sign in at http://localhost:3000
3. Candidate: alex.chen@example.com / password
4. Canvasser: priya.nair@example.com / password
5. Admin: superuser@localseat.io / password
6. Bench plan test: starter.candidate@example.com / password (Bench plan restrictions)
7. **Stripe is live on production** — local dev keeps `NEXT_PUBLIC_STRIPE_ENABLED=false` for instant-activate dev mode. To test Stripe locally: set `NEXT_PUBLIC_STRIPE_ENABLED=true` + live or test keys in `.env`, then run `C:\stripe\stripe.exe listen --forward-to localhost:3000/api/stripe/webhook` in a separate terminal
8. All new dev → localseat-staging repo first
9. **Sync staging Neon DB** after any new migration: `$env:DATABASE_URL='<neon-connection-string>' ; npx prisma migrate deploy`
10. Test on staging before production deploy
11. Production deploy: `git push origin main && git push staging main` → SSH → `cd /var/www/localseat && ./deploy.sh` → `cd /var/www/demo && ./deploy.sh`
12. Marketing site deploy (if changed): `scp "C:\Users\rkjai\OneDrive\Desktop\marketing-site\*.html" root@2.24.212.25:/var/www/marketing/` — pricing section is 5-card layout (Bench/Chair/Podium/Stage/Arena), Podium highlighted; prices fetched dynamically from `/api/pricing`; comparison modal available on pricing page
13. Run `npx prisma generate` after any migration
14. After any `prisma migrate dev` reset, run backfill.sql to create team Person records (seed data doesn't exist when migrations run)
