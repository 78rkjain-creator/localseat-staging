# LocalSeat.io — Handoff Notes

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
- Demo: /var/www/demo, PM2 `localseat-demo`, port 3001
- nginx: app.localseat.io → 3000, demo.localseat.io → 3001
- SSL: certbot, auto-renews
- Firewall: ports 22, 80, 443 open — 5432 blocked
- Demo reset cron: 3am (`npx prisma db seed`)
- DBs: `localseat_prod` (prod), `localseat_demo` (demo), Neon (staging)

---

## Deployment Workflow
1. Dev work → `git push staging main`
2. Vercel auto-deploys staging
3. **Test on staging before every production deploy**
4. `git push origin main` → SSH → `cd /var/www/localseat && ./deploy.sh`
5. **Always deploy app and demo together — never leave out of sync**

Demo deploy:
```
cd /var/www/demo
git pull origin main
npm run build
pm2 restart localseat-demo --update-env
npx prisma migrate deploy
npx prisma db seed
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

**Demo** (`/var/www/demo/.env`)
```
DATABASE_URL="postgresql://demo:LS_Demo_2026x@localhost:5432/localseat_demo"
NEXTAUTH_SECRET="localseat-demo-secret-2026"
NEXTAUTH_URL="https://demo.localseat.io"
DEMO_MODE="true"
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
- Role: candidate, campaign_manager, co_chair, field_organizer, canvasser, volunteer_coordinator, finance_lead, sign_installer, super_user
- ListImportType: list, telephone_list, official_voters_list
- PersonListMembershipStatus: matched, created, pending_review, accepted
- SignStatus: to_be_installed, installed
- TaskType: includes volunteer_follow_up

**Key Person fields:**
- isConfirmedVoter (bool) — set true on OVL match
- pollNumber — wired through full import pipeline
- wardStatus: not_checked | inside | outside | outside_accepted | pending_review
- customFieldValues (Json) — up to 5 campaign-defined fields

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
- `/voter-list` — all residents (Residents List in sidebar)
- `/voter-list/confirmed` — confirmed voters only (isConfirmedVoter === true)
- `/voter-list/confirmed/[personId]` — read-only voter summary with "View full record" link
- Person detail shows Residents List section (all named list memberships) and Voter List section (OVL matches)

### Custom Fields
- Defined at campaign level in `/campaign-settings/custom-fields` (candidate/campaign_manager only)
- Up to 5 fields per campaign, each a label + text value per person
- Editable on person detail, importable via CSV (column headers match field labels)
- Filter buttons on Residents List page filter by field presence (AND logic)
- Orphan cleanup runs on definition save

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
- Ward boundary: Polygon or MultiPolygon, Represent API picker, GeoJSON/KML upload
- All 555 Owen Sound addresses have pre-baked lat/lng in seed

### Security
- Security headers in next.config.ts: X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy
- Session timeout: 8h all roles, 4h canvassers (checked in proxy.ts)
- Rate limiting on auth routes
- Input sanitization on canvassing and outreach actions
- nodemailer v8 (SMTP injection CVEs patched)
- CSP (Content Security Policy) — NOT YET APPLIED, test on staging first

---

## Key Files
```
/prisma/schema.prisma, seed.ts
/src/app/(auth)/login, register, verify-email, resend-verification, reset-password
/src/app/(app)/
  dashboard, voter-list, voter-import, canvassing, follow-ups
  outreach, donors, volunteers, team, signs, campaigns, account, address-changes
  campaign-settings/ward, competitors, script, custom-fields
  voter-list/confirmed, voter-list/confirmed/[personId]
  voter-import/review
/src/app/admin/campaigns, users, audit-log, export, demo-leads, settings
/src/app/onboarding/choose-plan, create-campaign
/src/lib/
  auth.ts, db.ts, permissions.ts, sanitize.ts, rate-limit.ts
  people.ts, canvassing.ts, outreach.ts, activity.ts, dashboard.ts
  geocoding.ts, ward.ts, address-normalize.ts, competitors.ts
  email.ts, audit.ts, terms.ts, plan-limits.ts, offline-queue.ts
/src/components/layout/sidebar.tsx, mobile-nav.tsx
/src/hooks/useOfflineSync.ts
/public/sw.js
/scripts/geocode-demo.ts, export-geocoded-coords.ts
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
- `jszip` installed directly on demo server only — must add to package.json before next prod deploy or KMZ upload silently fails
- `as unknown as` Prisma casts in several files — resolves on next `npx prisma generate` when dev server not holding DLL
- Rate limiter resets on server restart — needs Redis for production scale
- Offline queue is per-device only
- Demo site shares one DB — multiple simultaneous users see each other's changes (deferred)
- staging and localseat.io repos can drift — always copy seed.ts and key shared files
- Staging Neon DB must have migrations applied manually (`prisma migrate deploy`) — Vercel does not auto-run migrations
- EPERM on Windows during `prisma generate` = known DLL lock from running dev server, not a real error

---

## Production Data Events
**April 23, 2026** — Production DB manually cleaned. Seed data removed. Superuser preserved. Production is empty and ready for real campaign data.

---

## Remaining Work

### High Priority
| Item | Effort |
|---|---|
| Activity timeline on person detail | Small |
| PWA manifest, install prompt, offline fallback | Small |
| Content Security Policy (CSP) — prompt written, test on staging first | Small |

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
2. Sign in at http://localhost:3001 (or 3000)
3. Candidate: alex.chen@example.com / password
4. Canvasser: priya.nair@example.com / password
5. Admin: superuser@localseat.io / password
6. All new dev → localseat-staging repo first
7. Test on staging before production deploy
8. Production deploy: `git push origin main` → SSH → `cd /var/www/localseat && ./deploy.sh`
9. If staging DB schema out of sync: `$env:DATABASE_URL='<neon-url>' ; npx prisma migrate deploy`
10. Run `npx prisma generate` after any migration
