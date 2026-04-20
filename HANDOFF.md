# LocalSeat.io — Handoff Notes

## How I Work

- Provide prompts for VS Code Claude plugin — not raw source code
- Read existing files only when information is not already known from context
- Run commands one at a time — PowerShell does not support `&&`
- Never run audit-only prompts when answer can be inferred from context

---

## What This Is

A lightweight Canada-focused municipal campaign CRM and canvassing platform. Built with Next.js, TypeScript, Tailwind CSS, PostgreSQL, and Prisma. Production on Hostinger VPS.

---

## Tech Stack

- Frontend/Backend: Next.js 16 with TypeScript and Tailwind CSS
- Database: PostgreSQL with Prisma ORM (v5 — do not upgrade)
- Auth: NextAuth.js v4 with credentials provider
- Email: Nodemailer via Hostinger SMTP
- SMS: Telnyx (decided, not yet built)
- Payments: Stripe (decided, not yet built)
- Production: Hostinger VPS (app.localseat.io)
- Demo: Hostinger VPS (demo.localseat.io)
- Staging: Vercel + Neon PostgreSQL (localseat-staging.vercel.app)
- Local dev: Windows, VS Code, Node v24

---

## Repository and URLs

- GitHub production: git@github.com:78rkjain-creator/localseat.io.git
- GitHub staging: https://github.com/78rkjain-creator/localseat-staging.git
- Local path: C:\Users\rkjai\OneDrive\Desktop\localseat.io
- Production: https://app.localseat.io
- Demo: https://demo.localseat.io
- Staging: https://localseat-staging.vercel.app

---

## Infrastructure

- Hostinger VPS KVM2: IP 2.24.212.25, Ubuntu 24.04, 8GB RAM, 100GB NVMe
- Production app: /var/www/localseat, PM2 process localseat, port 3000
- Demo app: /var/www/demo, PM2 process localseat-demo, port 3001
- Deploy script: /var/www/localseat/deploy.sh
- nginx routing app.localseat.io → 3000, demo.localseat.io → 3001
- SSL via certbot for both domains, auto-renews
- Firewall: ports 22, 80, 443 open — port 5432 blocked
- Daily demo reset cron: 3am via crontab (npx prisma db seed)
- PostgreSQL on VPS: localseat_prod (production), localseat_demo (demo)
- Staging DB: Neon PostgreSQL (free tier)

---

## Deployment Workflow

1. All development work → `git push staging main`
2. Vercel auto-deploys staging on every push
3. When ready for production → `git push origin main` (force if needed)
4. SSH into VPS and run `/var/www/localseat/deploy.sh`
5. Demo site pulls from localseat-staging repo — deploy with:

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

**Local .env**
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

**Production VPS (/var/www/localseat/.env)**
```
DATABASE_URL="postgresql://localseat:LS_Prod_2026x@localhost:5432/localseat_prod"
NEXTAUTH_SECRET="<generated secret>"
NEXTAUTH_URL="https://app.localseat.io"
DEMO_WEBHOOK_SECRET="localseat-demo-webhook-2026"
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM_WELCOME, SMTP_FROM_APPROVALS
NEXT_PUBLIC_STRIPE_ENABLED="false"   # set to "true" when Stripe is wired
```

**Demo VPS (/var/www/demo/.env)**
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

**Staging (Vercel)**
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
    └── Field Organizer
        └── Volunteer Coordinator
            └── Canvasser
```

Co-chair and Finance Lead are outside the main hierarchy. All 7 roles can access the canvassing screen except finance_lead.

---

## Platform Roles

| Role | Access |
|---|---|
| super_user | God mode — full platform access, export, billing, password reset, demo leads |
| super_admin | Full read/write across all campaigns, analytics, demo leads. No raw export or billing. |

---

## Important Technical Notes

- **CRITICAL:** This project uses `src/proxy.ts` NOT `middleware.ts` — Next.js 16 uses proxy.ts. Never create or rename to middleware.ts. Every tutorial online will say middleware.ts — ignore them for this project.
- Always run `taskkill /F /IM node.exe` before `npx prisma generate` on Windows
- After any `prisma migrate reset` or `prisma db seed`, sign out and back in to refresh JWT
- `.env` must never be committed to GitHub
- Support levels enum: `strong_yes`, `soft_yes`, `undecided`, `soft_no`, `strong_no`, `not_home`
- All campaign data scoped by `campaignId` — never query without it
- Prisma v5 intentionally pinned — do not upgrade
- PowerShell does not support `&&` — run commands one at a time
- Phone fields are `phoneHome` and `phoneMobile` — not a single phone field
- `DEMO_MODE=true` on demo site enables demo banner and redirects root to `/demo`
- `DEMO_WEBHOOK_SECRET` must match on both demo and production VPS `.env` files
- All export routes need `export const dynamic = 'force-dynamic'` for Vercel compatibility
- Pre-push git hook runs `npm run typecheck` — fix all TypeScript errors before pushing
- `npm run typecheck` must pass before every push to avoid failed Vercel builds

---

## What Has Been Built

### Foundation
- Next.js scaffold, PostgreSQL schema, NextAuth RBAC, campaign-scoped multi-tenancy
- Proxy route protection (src/proxy.ts), seed data, self-serve registration, campaign onboarding
- Campaign switcher, PWA (manifest, icons, meta tags)
- Terms and Conditions v1.3 — clean data policy, no data sale, predictive modelling clause

### Security
- Rate limiting on login (5 attempts / 15 min, email-keyed, in-memory)
- Session timeout 12 hours
- Input sanitization via src/lib/sanitize.ts
- Bcrypt password hashing at 12 rounds
- Role checks on all server actions
- Campaign isolation enforced on all queries
- Export routes re-verify campaign membership
- sameSite: strict on session cookie (production)

### Platform Hardening (12 fixes applied)
- Duplicate canvass response guard (upsert + unique constraint)
- Offline sync retry counter — bad items dropped after 3 failures
- previewFilter role and campaign ownership check
- IndexedDB enqueue failure visible error
- Offline responses timestamped at door-knock time
- Outreach CSV import batched queries
- Duplicate detection memory cap (take: 5000)
- addPersonAtDoor fails loudly if field-entry tag missing
- Volunteer shift assignment campaign ownership check
- Service worker failure visible to canvasser
- Canvasser route deny-list in proxy.ts
- Export routes re-verify campaign membership

### Email Infrastructure
- Nodemailer via Hostinger SMTP
- sendWelcomeEmail, sendVerificationEmail, sendApprovalRequestEmail, sendPasswordResetEmail
- All sends fire-and-forget

### Email Verification
- emailVerified, verificationToken, verificationTokenExpiry on User
- Unverified users blocked by proxy
- Accounts expire after 14 days
- Resend verification at /resend-verification

### Platform Admin (/admin)
- Admin dashboard with demo leads widget
- Campaigns list/detail, deactivate/reactivate/delete/restore
- Users list/detail, deactivate/reactivate, hard delete, password reset (email link)
- Super admin assignment/revocation
- Audit log viewer (paginated, plain English descriptions)
- Export page (voters, campaigns, users, audit logs) — super_user only
- Demo Leads page — filter, emailed tracking, CSV export — super_user and super_admin
- Admin account page — password change for platform users

### Audit Logging
- Centralized in src/lib/audit.ts
- Plain English descriptions via src/lib/audit-descriptions.ts
- Every data export logged with user, role, filters, row count
- All high-value actions logged

### Address Change Approval Workflow
- Modal shows household members with checkboxes
- Pending queue at /address-changes
- Field organizer and above can approve/reject
- Household split on approval
- Badge on dashboard for pending count

### Voter List (/voter-list)
- Search and tag filtering
- Person detail with notes, activity timeline, canvass history
- Poll number field, import source label
- CSV import/export with template
- Duplicate detection and merge
- Flagged row approval

### Official Import
- CSV template download
- Bulk import with source description (required)
- Duplicate detection with warning
- Poll number mapping

### Walk Lists
- Index, detail, canvasser assignment
- Filter-based population
- CSV import/export
- Progress tracking
- Poll number display

### Mobile Canvassing
- One-thumb optimized
- All support levels, toggles, not-home, add person at door
- Offline support — IndexedDB queue, syncs on reconnect
- Service worker registered and working in production
- Offline caching via sw.js served from public/

### Dashboards
- Role-specific dashboards for all roles
- Voter ID breakdown, walk list progress, follow-up queue
- Donor pipeline, outreach activity, team roster

### Follow-up Workflow
- Auto-created on canvasser toggle
- Unassigned queue, manager assignment, mark complete
- Reassignment working

### Outreach Log
- Master touchpoint record
- Auto-logs door knocks
- Manual entry, CSV import/export

### Donor Tracking
- Separate donor records
- Auto-created on canvasser flag
- Status tracking, thank you tracking, CSV export

### Volunteer Coordination
- /volunteers/schedule — shift creation, assignment, attendance, inline edit

### Team Management
- /team — role assignment, member removal (soft delete), restore removed members
- Candidate-only campaign_manager assignment

### Soft Delete
- Every model has `deletedAt DateTime?` except CanvassResponse and AuditLog
- Super admin can view and restore soft-deleted records

### Demo Site
- https://demo.localseat.io
- Registration form captures leads (name, email, phone, municipality, office, consent)
- Leads sent via webhook to production database
- Auto-login as Demo Login (demo@localseat.io)
- Demo banner with role switcher (DEMO_MODE=true)
- Daily 3am reset via cron (preserves DemoRegistration records)
- 1500 voters, full campaign team, walk lists, donors, volunteers

### Tier & Pricing Foundation

- PlanTier enum on Campaign: starter | campaign | election | demo
- plan, planActivated, amountPaid, planLockedAt fields added to Campaign model
- PlatformSettings model — generic key/value store for pricing and limits per tier
- CampaignOverride model — per-campaign limit exceptions with internal notes and audit fields
- src/lib/plan-limits.ts — resolves effective limits by merging tier defaults, campaign overrides, and demo bypass logic
- Limit enforcement wired at four points: voter import, add person at door, team invite, donor creation
- /admin/settings — super_user can edit tier pricing, labels, and limits live from DB; super_admin is read-only
- Campaign override panel added to /admin/campaigns/[id] — accessible to super_user and super_admin only
- /onboarding/choose-plan — dev tier selector loads pricing live from PlatformSettings
- NEXT_PUBLIC_STRIPE_ENABLED=false enables dev mode — plan selected without payment
- When NEXT_PUBLIC_STRIPE_ENABLED=true, choose-plan buttons show "Coming soon" until Stripe is wired
- Demo campaigns bypass all limit checks regardless of overrides
- All plan selections and override changes are audit logged

### Automated Tests (src/__tests__/)
- canvass-response-dedup.test.ts
- canvasser-route-protection.test.ts
- export-membership-check.test.ts
- export-membership-revocation.test.ts
- outreach-import-batching.test.ts
- volunteer-shift-ownership.test.ts

---

## Remaining Work

### Active

| Item | Effort |
|---|---|
| Marketing site at localseat.io | Medium |
| Operations guide document | Small |
| Text messaging (Telnyx + Stripe + approval + CRTC) | Large |
| Admin platform settings page | Medium — Done |
| Stripe payment integration on choose-plan page | Dev tier selector done. Stripe wiring is the remaining step. |
| Update HANDOFF.md at end of each session | Small — ongoing |
| Map-based turf cutting (Leaflet + OpenStreetMap) | Large |
| Demo instance isolation — Option 3 (unique DB per visitor) | Large |

### Defined — Ready to Build When Scheduled

| Item | Effort |
|---|---|
| Official voter list reconciliation engine (4 prompts) — address normalization, fuzzy name matching, phone preservation, field-level merge control, manual review screen, unmatched record handling, audit trail, data quality scoring, import source labeling | Large |

### V2+ Backlog — Out of Scope for V1

Payment processing, online donations, mass texting, email broadcasts, predictive voter scoring, advanced analytics, native iOS/Android apps, social media publishing tools, party integrations (federal/provincial), multilingual interface, campaign branding/custom theming, federal/provincial compliance workflows.

### Known Limitations

- Rate limiter resets on server restart (needs Redis for production scale)
- Offline queue is per-device only
- Demo site shares one database — multiple simultaneous users see each other's changes (deferred to Option 3)

---

## Key Files

```
/prisma
  schema.prisma        (includes PlatformSettings, CampaignOverride, PlanTier enum)
  seed.ts
/src
  /app
    /(auth)/login, /register, /verify-email, /resend-verification, /account-expired, /reset-password
    /(app)/dashboard, /voter-list, /voter-import, /canvassing, /follow-ups
             /outreach, /donors, /volunteers, /team, /campaigns, /account, /address-changes
    /admin/campaigns, /users, /audit-log, /export, /demo-leads, /account, /settings
    /onboarding/choose-plan, /create-campaign
    /demo
    /api/demo-leads
  /lib
    auth.ts, db.ts, permissions.ts, sanitize.ts, rate-limit.ts
    email.ts, verification.ts, audit.ts, audit-descriptions.ts
    address-changes.ts, people.ts, canvassing.ts, outreach.ts, activity.ts
    offline-queue.ts, terms.ts, plan-limits.ts
  /hooks/useOfflineSync.ts
  /components/layout/demo-banner.tsx
  proxy.ts
  /__tests__/
/public/sw.js
```

---

## How to Start the Next Session

1. `npm run dev`
2. Sign in at http://localhost:3000
3. Admin access: superuser@localseat.io / password
4. Production: https://app.localseat.io
5. Demo: https://demo.localseat.io
6. Staging: https://localseat-staging.vercel.app
7. Provide prompts for the VS Code Claude plugin — not raw source code
8. All new development goes to localseat-staging repo first
