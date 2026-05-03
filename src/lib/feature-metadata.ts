export const FEATURE_METADATA: Record<
  string,
  { name: string; description: string; requiredPlan: "chair" | "podium" | "stage" }
> = {
  donor_tracking: {
    name: "Donor Tracking",
    description:
      "Track donor prospects, log contributions, send thank-you reminders, and export donor reports for your campaign filings.",
    requiredPlan: "chair",
  },
  follow_up_queue: {
    name: "Follow-up Queue",
    description:
      "Manage follow-up tasks from canvassing — track who needs a callback, a yard sign, or more information.",
    requiredPlan: "chair",
  },
  analytics: {
    name: "Analytics",
    description:
      "Visualize your canvassing progress — support trends over time, doors per day, and canvasser performance.",
    requiredPlan: "podium",
  },
  events: {
    name: "Campaign Events",
    description:
      "Create and manage campaign events — town halls, canvass kickoffs, volunteer training sessions. Track attendees and check-ins.",
    requiredPlan: "chair",
  },
  custom_fields: {
    name: "Custom Fields",
    description:
      "Add custom data fields to constituent records — track anything specific to your campaign that the default fields don't cover.",
    requiredPlan: "chair",
  },
  sign_tracking: {
    name: "Sign Tracking",
    description:
      "Track campaign sign locations, assign installers, and manage sign inventory across your ward.",
    requiredPlan: "chair",
  },
  contact_map: {
    name: "Contact Map",
    description:
      "View all your constituents on an interactive map — see coverage, identify gaps, and plan your canvassing routes.",
    requiredPlan: "podium",
  },
  reports: {
    name: "Campaign Reports",
    description:
      "Generate summary reports on canvassing activity, voter contact rates, and campaign progress.",
    requiredPlan: "podium",
  },
  canvass_script: {
    name: "Canvass Script",
    description:
      "Write a standardized door-knocking script that your canvassers see on the mobile canvassing screen. Keeps your message consistent.",
    requiredPlan: "chair",
  },
  surveys: {
    name: "Survey Builder",
    description:
      "Build custom survey questions that appear on the canvassing screen. Collect structured data beyond standard support levels.",
    requiredPlan: "stage",
  },
  digital_signatures: {
    name: "Digital Signature Capture",
    description:
      "Collect digital signatures at the door — for nomination papers, petitions, or consent forms. Stored securely with each constituent record.",
    requiredPlan: "stage",
  },
  volunteer_coordination: {
    name: "Volunteer Coordination",
    description:
      "Manage volunteer records, schedule shifts, track attendance, and coordinate your campaign's volunteer team.",
    requiredPlan: "podium",
  },
  finance_lead_access: {
    name: "Finance Lead Access",
    description:
      "Add a Finance Lead role to your campaign — a dedicated team member who can manage donor records without full campaign access.",
    requiredPlan: "podium",
  },
};
