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
  | "strong_support"
  | "lean_support"
  | "undecided"
  | "lean_against"
  | "strong_against"
  | "unknown";

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
  strong_support: "Strong Support",
  lean_support: "Lean Support",
  undecided: "Undecided",
  lean_against: "Lean Against",
  strong_against: "Strong Against",
  unknown: "Unknown",
};

export const CANVASS_OUTCOME_LABELS: Record<CanvassOutcome, string> = {
  contacted: "Contacted",
  not_home: "Not Home",
  refused: "Refused",
  moved: "Moved",
  unavailable: "Unavailable",
  deceased: "Deceased",
};
