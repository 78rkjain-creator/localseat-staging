// Core shared types for the LocalSeat platform.
// Enums mirror prisma/schema.prisma — keep these in sync.

export type Role =
  | "candidate"
  | "campaign_manager"
  | "field_organizer"
  | "canvasser"
  | "volunteer_coordinator"
  | "finance_lead";

export type SupportLevel =
  | "strong_yes"
  | "soft_yes"
  | "undecided"
  | "soft_no"
  | "strong_no"
  | "not_home";

export type CanvassOutcome =
  | "contacted"
  | "not_home"
  | "refused"
  | "moved"
  | "unavailable"
  | "deceased";

export type OutreachMethod =
  | "door"
  | "phone"
  | "email"
  | "text"
  | "event"
  | "other";

// The membership summary embedded in the session JWT
export interface SessionMembership {
  campaignId: string;
  campaignName: string;
  role: Role;
}

// The active user session shape used throughout the app
export interface AppSession {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  memberships: SessionMembership[];
  activeCampaignId: string | null;
  activeRole: Role | null;
}

// Human-readable labels for roles
export const ROLE_LABELS: Record<Role, string> = {
  candidate: "Candidate",
  campaign_manager: "Campaign Manager",
  field_organizer: "Field Organizer",
  canvasser: "Canvasser",
  volunteer_coordinator: "Volunteer Coordinator",
  finance_lead: "Finance Lead",
};

export const SUPPORT_LEVEL_LABELS: Record<SupportLevel, string> = {
  strong_yes: "Strong Yes",
  soft_yes:   "Soft Yes",
  undecided:  "Undecided",
  soft_no:    "Soft No",
  strong_no:  "Strong No",
  not_home:   "Not Home",
};

export const CANVASS_OUTCOME_LABELS: Record<CanvassOutcome, string> = {
  contacted: "Contacted",
  not_home: "Not Home",
  refused: "Refused",
  moved: "Moved",
  unavailable: "Unavailable",
  deceased: "Deceased",
};
