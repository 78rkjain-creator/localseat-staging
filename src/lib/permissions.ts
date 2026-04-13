import type { Role } from "@/types";

// Role hierarchy from broadest to narrowest access
const ROLE_RANK: Record<Role, number> = {
  campaign_manager: 100,
  candidate: 90,
  field_organizer: 70,
  volunteer_coordinator: 60,
  finance_lead: 50,
  canvasser: 10,
};

export function canManageCampaign(role: Role): boolean {
  return role === "campaign_manager";
}

export function canManageWalkLists(role: Role): boolean {
  return ["campaign_manager", "field_organizer"].includes(role);
}

export function canAssignCanvassers(role: Role): boolean {
  return ["campaign_manager", "field_organizer"].includes(role);
}

export function canViewAllPeople(role: Role): boolean {
  return ["campaign_manager", "candidate", "field_organizer"].includes(role);
}

export function canViewDonors(role: Role): boolean {
  return ["campaign_manager", "finance_lead", "candidate"].includes(role);
}

export function canViewVolunteers(role: Role): boolean {
  return [
    "campaign_manager",
    "field_organizer",
    "volunteer_coordinator",
  ].includes(role);
}

export function canManageVoterList(role: Role): boolean {
  return role === "campaign_manager";
}

export function canExportData(role: Role): boolean {
  return ["campaign_manager", "finance_lead"].includes(role);
}

export function canViewDashboard(role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK["canvasser"];
}

export function isCanvasser(role: Role): boolean {
  return role === "canvasser";
}

// Returns true if the given role is at least as privileged as the minimum role
export function hasMinimumRole(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
