import type { Role } from "@/types";

// Role hierarchy from broadest to narrowest access
const ROLE_RANK: Record<Role, number> = {
  candidate: 100,
  campaign_manager: 100,
  field_organizer: 70,
  volunteer_coordinator: 60,
  finance_lead: 50,
  canvasser: 10,
};

// Candidate and campaign_manager have identical operational access.
// The only difference: only the candidate can assign the campaign_manager role.
const FULL_ACCESS_ROLES: Role[] = ["candidate", "campaign_manager"];

export function canManageCampaign(role: Role): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}

export function canManageWalkLists(role: Role): boolean {
  return [...FULL_ACCESS_ROLES, "field_organizer"].includes(role);
}

export function canAssignCanvassers(role: Role): boolean {
  return [...FULL_ACCESS_ROLES, "field_organizer"].includes(role);
}

export function canViewAllPeople(role: Role): boolean {
  return [...FULL_ACCESS_ROLES, "field_organizer"].includes(role);
}

export function canViewDonors(role: Role): boolean {
  return [...FULL_ACCESS_ROLES, "finance_lead", "field_organizer"].includes(role);
}

// Only finance roles and full-access roles see amounts and payment details
export function canViewDonorAmounts(role: Role): boolean {
  return [...FULL_ACCESS_ROLES, "finance_lead"].includes(role);
}

export function canViewVolunteers(role: Role): boolean {
  return [...FULL_ACCESS_ROLES, "field_organizer", "volunteer_coordinator"].includes(role);
}

export function canManageVoterList(role: Role): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}

export function canExportData(role: Role): boolean {
  return [...FULL_ACCESS_ROLES, "finance_lead"].includes(role);
}

export function canViewDashboard(role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK["canvasser"];
}

export function isCanvasser(role: Role): boolean {
  return role === "canvasser";
}

// Follow-up queue: managers, organizers, volunteer coordinators, and canvassers
// (canvassers see only their own assigned tasks — enforced in the query layer)
export function canViewFollowUps(role: Role): boolean {
  return true; // all authenticated users can access /follow-ups
}

// Full queue view (all unassigned + all assigned tasks for the campaign)
export function canManageFollowUps(role: Role): boolean {
  return [...FULL_ACCESS_ROLES, "field_organizer", "volunteer_coordinator"].includes(role);
}

// Team management: candidate and campaign_manager only
export function canManageTeam(role: Role): boolean {
  return FULL_ACCESS_ROLES.includes(role);
}

// Only the candidate can assign or change the campaign_manager role.
// Campaign managers cannot promote others to campaign_manager.
export function canAssignCampaignManager(role: Role): boolean {
  return role === "candidate";
}

// Returns true if the given role is at least as privileged as the minimum role
export function hasMinimumRole(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
