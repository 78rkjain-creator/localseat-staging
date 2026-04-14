// Core shared types for the LocalSeat platform.
// Enums mirror prisma/schema.prisma — keep these in sync.

export type Role =
  | "candidate"
  | "campaign_manager"
  | "co_chair"
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

export type OutreachChannel =
  | "door_knock"
  | "phone_call"
  | "email"
  | "text_message"
  | "in_person"
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
  co_chair: "Co-Chair",
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

export type VolunteerStatus = "interested" | "committed";

export const VOLUNTEER_STATUS_LABELS: Record<VolunteerStatus, string> = {
  interested: "Interested",
  committed:  "Committed",
};

export type VolunteerAttendanceStatus = "pending" | "attended" | "no_show";

export const VOLUNTEER_ATTENDANCE_LABELS: Record<VolunteerAttendanceStatus, string> = {
  pending:  "Pending",
  attended: "Attended",
  no_show:  "No show",
};

export type DonorStatus = "interested" | "pledged" | "received";
export type PaymentMethod = "cash" | "cheque" | "e_transfer" | "other";

export const DONOR_STATUS_LABELS: Record<DonorStatus, string> = {
  interested: "Interested",
  pledged:    "Pledged",
  received:   "Received",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:       "Cash",
  cheque:     "Cheque",
  e_transfer: "e-Transfer",
  other:      "Other",
};

export const OUTREACH_CHANNEL_LABELS: Record<OutreachChannel, string> = {
  door_knock:   "Door knock",
  phone_call:   "Phone call",
  email:        "Email",
  text_message: "Text message",
  in_person:    "In person",
  other:        "Other",
};

export const CANVASS_OUTCOME_LABELS: Record<CanvassOutcome, string> = {
  contacted: "Contacted",
  not_home: "Not Home",
  refused: "Refused",
  moved: "Moved",
  unavailable: "Unavailable",
  deceased: "Deceased",
};
