import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ── Role hierarchy ────────────────────────────────────────────────────────────
//
// Strict top-down hierarchy. Every role inherits all permissions of the roles
// below it. Roles outside the active hierarchy (co_chair, finance_lead,
// sign_installer) receive the lowest rank and no explicit permissions.
//
//   candidate (100)
//     └─ campaign_manager (90)
//          └─ data_manager (90) — same permissions as campaign_manager
//               └─ field_organizer (70)
//                    └─ volunteer_coordinator (60)
//                         └─ canvasser (10)
//                              └─ sign_installer (3) — signs section only

const ROLE_RANK: Record<Role, number> = {
  candidate:            100,
  campaign_manager:      90,
  data_manager:          90,
  field_organizer:       70,
  volunteer_coordinator: 60,
  canvasser:             10,
  // Outside the active hierarchy — no operational permissions granted
  co_chair:               5,
  finance_lead:           5,
  sign_installer:         3,
  // Supplier portal only — no campaign data access
  data_supplier:          0,
};

// Returns true if role is at least as privileged as the minimum threshold.
export function hasMinimumRole(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

// ── Core groups (reused across helpers) ──────────────────────────────────────

const FULL_ACCESS: Role[] = [Role.candidate, Role.campaign_manager, Role.data_manager];
const FIELD_AND_ABOVE: Role[] = [...FULL_ACCESS, Role.field_organizer];
const VOL_AND_ABOVE: Role[] = [...FIELD_AND_ABOVE, Role.volunteer_coordinator];

// ── Team ──────────────────────────────────────────────────────────────────────

// candidate, campaign_manager, field_organizer, and co_chair can view the team page.
// co_chair is read-only (enforced via isReadOnly). finance_lead has no team access.
export function canViewTeam(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role) || role === Role.co_chair;
}

// All authenticated campaign members can view the /people/team leadership directory.
export function canViewTeamDirectory(_role: Role): boolean {
  return true;
}

// Only candidate and campaign_manager may add or remove team members.
export function canManageTeam(role: Role): boolean {
  return FULL_ACCESS.includes(role);
}

// Only the candidate may promote someone to campaign_manager.
export function canAssignCampaignManager(role: Role): boolean {
  return role === Role.candidate;
}

// ── Role management ───────────────────────────────────────────────────────────

// Only the candidate may change roles freely (including assigning candidate).
// super_user access is checked separately at the call site via isSuperUser().
export function canManageRoles(role: Role): boolean {
  return role === Role.candidate;
}

// campaign_manager and data_manager may change any role except candidate.
// candidate and super_user have full access — handled here and via isSuperUser().
// Note: only candidate and campaign_manager may *assign* the data_manager role (enforced at call sites).
export function canManageRolesExceptCandidate(role: Role): boolean {
  return FULL_ACCESS.includes(role);
}

// ── Donors ────────────────────────────────────────────────────────────────────

// Donor records: senior leadership + finance_lead + co_chair (read-only).
// finance_lead exists specifically to manage donor tracking without full campaign access.
export function canViewDonors(role: Role): boolean {
  return FULL_ACCESS.includes(role) || role === Role.finance_lead || role === Role.co_chair;
}

// Donation amounts are sensitive — finance_lead sees them, co_chair does not.
export function canViewDonorAmounts(role: Role): boolean {
  return FULL_ACCESS.includes(role) || role === Role.finance_lead;
}

// ── Walk lists and canvassing ─────────────────────────────────────────────────

// Creating, editing, and deleting walk lists.
export function canManageWalkLists(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role) || role === Role.volunteer_coordinator || role === Role.co_chair;
}

// Assigning canvassers to lists (field organizer and above).
export function canAssignCanvassers(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role);
}

// Most roles can access the canvassing workflow. finance_lead is excluded —
// their access is limited to donor records only.
export function canCanvass(role: Role): boolean {
  return ([
    Role.candidate,
    Role.campaign_manager,
    Role.data_manager,
    Role.field_organizer,
    Role.volunteer_coordinator,
    Role.canvasser,
    Role.co_chair,
  ] as Role[]).includes(role);
}

// ── Volunteers ────────────────────────────────────────────────────────────────

// Viewing and managing volunteer records and shifts.
export function canManageVolunteers(role: Role): boolean {
  return VOL_AND_ABOVE.includes(role);
}

// Viewing volunteer records and schedule (broader than manage — includes co_chair).
export function canViewVolunteers(role: Role): boolean {
  return (
    canManageVolunteers(role) ||
    role === Role.co_chair
  );
}

// ── Follow-ups ────────────────────────────────────────────────────────────────

// Viewing the follow-up queue (canvassers see only their own tasks — query layer).
// co_chair can view all follow-ups (read-only).
export function canViewFollowUps(role: Role): boolean {
  return VOL_AND_ABOVE.includes(role) || role === Role.canvasser || role === Role.co_chair;
}

// Assigning, completing, and managing all follow-up tasks.
export function canManageFollowUps(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role);
}

// ── People / voter list ───────────────────────────────────────────────────────

// co_chair can view all people (read-only). finance_lead cannot.
export function canViewAllPeople(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role) || role === Role.co_chair;
}

export function canManageVoterList(role: Role): boolean {
  return FULL_ACCESS.includes(role);
}

// Permission for the team-import page. Mirrors the rules in
// src/app/(app)/import/team/page.tsx.
export function canImportTeam(role: Role): boolean {
  return (
    [Role.candidate, Role.campaign_manager, Role.co_chair, Role.field_organizer] as Role[]
  ).includes(role);
}

// Visible if the user has access to ANY import type. The hub itself then
// shows different cards per that user's specific permissions.
export function canAccessImportHub(role: Role): boolean {
  return canManageVoterList(role) || canImportTeam(role);
}

// field_organizer and above may manually add residents.
export function canAddResident(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role);
}

// ── Tags ──────────────────────────────────────────────────────────────────────

// candidate and campaign_manager may create, rename, recolor, and delete tags.
export function canManageTags(role: Role): boolean {
  return FULL_ACCESS.includes(role);
}

// ── Campaign ──────────────────────────────────────────────────────────────────

export function canManageCampaign(role: Role): boolean {
  return FULL_ACCESS.includes(role);
}

// ── Data export ───────────────────────────────────────────────────────────────

// finance_lead can export donor data specifically. co_chair can export general data.
export function canExportData(role: Role): boolean {
  return FULL_ACCESS.includes(role) || role === Role.finance_lead || role === Role.co_chair;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

// All roles at or above canvasser, plus co_chair, finance_lead, and sign_installer.
export function canViewDashboard(role: Role): boolean {
  return (
    ROLE_RANK[role] >= ROLE_RANK[Role.canvasser] ||
    role === Role.co_chair ||
    role === Role.finance_lead ||
    role === Role.sign_installer
  );
}

// ── Signs ─────────────────────────────────────────────────────────────────────

// All campaign members can view signs.
export function canViewSigns(role: Role): boolean {
  return true;
}

// All roles except co_chair (read-only) can manage signs.
export function canManageSigns(role: Role): boolean {
  return role !== Role.co_chair;
}

// ── Reports ───────────────────────────────────────────────────────────────────

// field_organizer and above may view reports. Finance lead and canvasser cannot.
export function canViewReports(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role);
}

// ── Special flags ─────────────────────────────────────────────────────────────

// co_chair has broad read access but cannot modify campaign data.
// All write actions must separately check canManage* before proceeding.
export function isReadOnly(role: Role): boolean {
  return role === Role.co_chair;
}

export function isCanvasser(role: Role): boolean {
  return role === Role.canvasser;
}

// ── Address change requests ───────────────────────────────────────────────────

// field_organizer and above may review (approve / reject) address change requests.
export function canReviewAddressChanges(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role) || role === Role.co_chair;
}

// ── Platform-level roles (cross-campaign) ─────────────────────────────────────

export function isSuperUser(platformRole: string | null | undefined): boolean {
  return platformRole === "super_user";
}

// super_user inherits all super_admin capabilities
export function isSuperAdmin(platformRole: string | null | undefined): boolean {
  return platformRole === "super_user" || platformRole === "super_admin";
}

// ── Async auth guards (shared across admin action files) ──────────────────────

export async function requireSuperUser() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  if (!isSuperUser(session.user.platformRole)) {
    return { error: "Super user access required." } as const;
  }
  return { session } as const;
}

export async function requirePlatformAdmin() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  if (!isSuperAdmin(session.user.platformRole)) {
    return { error: "Platform admin access required." } as const;
  }
  return { session } as const;
}

// ── Data supplier system ───────────────────────────────────────────────────────

// candidate and campaign_manager can invite and manage data suppliers.
export function canManageSuppliers(role: Role): boolean {
  return role === Role.candidate || role === Role.campaign_manager;
}

// candidate, campaign_manager, and data_manager can review and approve data imports.
export function canReviewDataImports(role: Role): boolean {
  return FULL_ACCESS.includes(role);
}
