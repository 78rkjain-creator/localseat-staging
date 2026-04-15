import { Role } from "@prisma/client";

// ── Role hierarchy ────────────────────────────────────────────────────────────
//
// Strict top-down hierarchy. Every role inherits all permissions of the roles
// below it. Roles outside the active hierarchy (co_chair, finance_lead) receive
// the lowest rank and no explicit permissions.
//
//   candidate (100)
//     └─ campaign_manager (90)
//          └─ field_organizer (70)
//               └─ volunteer_coordinator (60)
//                    └─ canvasser (10)

const ROLE_RANK: Record<Role, number> = {
  candidate:            100,
  campaign_manager:      90,
  field_organizer:       70,
  volunteer_coordinator: 60,
  canvasser:             10,
  // Outside the active hierarchy — no operational permissions granted
  co_chair:               5,
  finance_lead:           5,
};

// Returns true if role is at least as privileged as the minimum threshold.
export function hasMinimumRole(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

// ── Core groups (reused across helpers) ──────────────────────────────────────

const FULL_ACCESS: Role[] = [Role.candidate, Role.campaign_manager];
const FIELD_AND_ABOVE: Role[] = [...FULL_ACCESS, Role.field_organizer];
const VOL_AND_ABOVE: Role[] = [...FIELD_AND_ABOVE, Role.volunteer_coordinator];

// ── Team ──────────────────────────────────────────────────────────────────────

// candidate, campaign_manager, field_organizer can view the team page.
// Below campaign_manager the view is read-only (enforced in the UI layer).
export function canViewTeam(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role);
}

// Only candidate and campaign_manager may add or remove team members.
export function canManageTeam(role: Role): boolean {
  return FULL_ACCESS.includes(role);
}

// Only the candidate may promote someone to campaign_manager.
export function canAssignCampaignManager(role: Role): boolean {
  return role === Role.candidate;
}

// ── Donors ────────────────────────────────────────────────────────────────────

// Donor records are restricted to senior leadership only.
export function canViewDonors(role: Role): boolean {
  return FULL_ACCESS.includes(role);
}

export function canViewDonorAmounts(role: Role): boolean {
  return FULL_ACCESS.includes(role);
}

// ── Walk lists and canvassing ─────────────────────────────────────────────────

// Creating, editing, and deleting walk lists.
export function canManageWalkLists(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role);
}

// Assigning canvassers to lists (field organizer and above).
export function canAssignCanvassers(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role);
}

// Every role may access the canvassing workflow.
export function canCanvass(role: Role): boolean {
  return [
    Role.candidate,
    Role.campaign_manager,
    Role.field_organizer,
    Role.volunteer_coordinator,
    Role.canvasser,
    Role.co_chair,
    Role.finance_lead,
  ].includes(role);
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
export function canViewFollowUps(role: Role): boolean {
  return VOL_AND_ABOVE.includes(role) || role === Role.canvasser;
}

// Assigning, completing, and managing all follow-up tasks.
export function canManageFollowUps(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role);
}

// ── People / voter list ───────────────────────────────────────────────────────

export function canViewAllPeople(role: Role): boolean {
  return FIELD_AND_ABOVE.includes(role);
}

export function canManageVoterList(role: Role): boolean {
  return FULL_ACCESS.includes(role);
}

// ── Campaign ──────────────────────────────────────────────────────────────────

export function canManageCampaign(role: Role): boolean {
  return FULL_ACCESS.includes(role);
}

// ── Data export ───────────────────────────────────────────────────────────────

export function canExportData(role: Role): boolean {
  return FULL_ACCESS.includes(role);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

// All roles with a rank at or above canvasser may access the dashboard.
export function canViewDashboard(role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[Role.canvasser];
}

// ── Special flags ─────────────────────────────────────────────────────────────

// No roles in the current hierarchy are purely read-only.
export function isReadOnly(_role: Role): boolean {
  return false;
}

export function isCanvasser(role: Role): boolean {
  return role === Role.canvasser;
}
