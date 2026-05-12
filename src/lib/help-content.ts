/**
 * Contextual help content for the in-app help system.
 *
 * Each entry maps a route pattern to a concise screen description and a list of
 * quick-action help items.  The HelpButton component matches the current
 * pathname against these entries (longest prefix wins) and displays the
 * matching content in a lightweight popup.
 */

export interface HelpQuickAction {
  /** Short label shown on the card */
  label: string;
  /** One-sentence explanation */
  description: string;
  /** Optional deep-link to the relevant page or section */
  href?: string;
}

export interface HelpEntry {
  /** Route prefix to match (longest match wins) */
  route: string;
  /** Screen title shown at the top of the popup */
  title: string;
  /** 1–2 sentence summary of what this screen does */
  summary: string;
  /** Quick-action cards the user can tap for more guidance */
  actions: HelpQuickAction[];
}

// ─── Content ─────────────────────────────────────────────────────────────────

export const HELP_ENTRIES: HelpEntry[] = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    route: "/dashboard",
    title: "Dashboard",
    summary:
      "Your campaign at a glance — voter ID progress, doors knocked, follow-ups, and team activity. What you see depends on your role.",
    actions: [
      {
        label: "Understand the metrics",
        description:
          "Each card shows a key campaign number — hover or tap any card to see what it measures.",
      },
      {
        label: "Start canvassing",
        description:
          "Tap your assigned walk list then hit Start Canvassing to begin knocking doors.",
        href: "/canvassing",
      },
      {
        label: "View your team",
        description:
          "See who's on the campaign, their roles, and recent activity.",
        href: "/team",
      },
    ],
  },

  // ── People — detail page ──────────────────────────────────────────────────
  {
    route: "/people/map",
    title: "Contact Map",
    summary:
      "A map of every contact in your database, colour-coded by support level. Zoom, pan, and tap pins to see details.",
    actions: [
      {
        label: "Filter by support level",
        description:
          "Use the legend toggles to show or hide specific support levels on the map.",
      },
      {
        label: "Find an address",
        description:
          "Use the search bar to jump directly to a specific address on the map.",
      },
    ],
  },
  {
    route: "/people/duplicates",
    title: "Duplicate Review",
    summary:
      "LocalSeat found records that may be the same person. Review each pair and merge or dismiss them to keep your data clean.",
    actions: [
      {
        label: "Merge duplicates",
        description:
          "Select which record to keep as primary, then merge. All activity from both records is combined.",
      },
      {
        label: "Dismiss a match",
        description:
          "If two records are different people, dismiss the match and they won't appear here again.",
      },
    ],
  },
  {
    route: "/people/out-of-district",
    title: "Out-of-District",
    summary:
      "People flagged as living outside your ward or municipality boundary. They won't appear on walk lists.",
    actions: [
      {
        label: "Reclassify a person",
        description:
          "If someone was flagged incorrectly, open their record and update their address or district status.",
      },
    ],
  },
  {
    route: "/people/residents",
    title: "Residents",
    summary:
      "All people linked to addresses in your municipality — your door-to-door universe.",
    actions: [
      {
        label: "Search residents",
        description:
          "Use the search bar to find people by name, address, phone, or email.",
      },
      {
        label: "Filter by tags",
        description:
          "Narrow the list using tags like Senior, Parent, or any custom tag you've created.",
      },
    ],
  },
  {
    route: "/people/voters",
    title: "Voter List",
    summary:
      "Confirmed voters imported from your official voter roll. This is a subset of your full people database.",
    actions: [
      {
        label: "Import a voter list",
        description:
          "Upload your official voter roll (CSV or Excel) and map columns to LocalSeat fields.",
        href: "/import/voters",
      },
      {
        label: "Search voters",
        description:
          "Find a specific voter by name, address, or poll number.",
      },
    ],
  },
  {
    route: "/people/volunteers",
    title: "Volunteers",
    summary:
      "People who expressed volunteer interest during canvassing or were manually tagged as volunteers.",
    actions: [
      {
        label: "View volunteer details",
        description:
          "Tap any volunteer to see their availability, skills, and activity history.",
      },
      {
        label: "Manage shifts",
        description:
          "Create and assign volunteer shifts for canvassing, events, or phone banking.",
        href: "/volunteers/schedule",
      },
    ],
  },
  {
    route: "/people/team",
    title: "Team Directory",
    summary:
      "Your campaign's leadership team. Everyone on the campaign can see this page.",
    actions: [
      {
        label: "View team roles",
        description:
          "Each team member's role determines what they can see and do in the platform.",
      },
    ],
  },
  {
    route: "/people/new",
    title: "Add Person",
    summary:
      "Manually add a new constituent to your campaign database. Fill in name, address, and any tags.",
    actions: [
      {
        label: "Required fields",
        description:
          "At minimum you need a first name and last name. Address is strongly recommended for canvassing.",
      },
    ],
  },
  {
    route: "/people",
    title: "People",
    summary:
      "Every person in your campaign database — voters, residents, volunteers, and team members. Search, filter, and manage records here.",
    actions: [
      {
        label: "Search & filter",
        description:
          "Find people by name, address, phone, email, tag, or support level using the search bar and filters.",
      },
      {
        label: "Add a person",
        description:
          "Click Add Person to manually create a new constituent record.",
        href: "/people/new",
      },
      {
        label: "Review duplicates",
        description:
          "LocalSeat auto-detects potential duplicates. Review and merge them to keep your data clean.",
        href: "/people/duplicates",
      },
      {
        label: "View sub-lists",
        description:
          "Switch between All People, Residents, Voter List, Volunteers, Team, and Out-of-District views.",
      },
    ],
  },

  // ── Canvassing ─────────────────────────────────────────────────────────────
  {
    route: "/canvassing/turf",
    title: "Turf Cutting",
    summary:
      "Draw a boundary on the map to create a walk list from all addresses inside it. Great for neighbourhood-level targeting.",
    actions: [
      {
        label: "Draw a boundary",
        description:
          "Click the map to drop points and form a polygon. Close the shape to define your turf.",
      },
      {
        label: "Save as walk list",
        description:
          "Once drawn, name the turf and save it — a walk list is created with all addresses inside.",
      },
    ],
  },
  {
    route: "/canvassing/street-walk",
    title: "Street Walk",
    summary:
      "Knock doors not on your assigned list. Enter any address and LocalSeat will find or create the record for you.",
    actions: [
      {
        label: "Enter an address",
        description:
          "Type the street address and LocalSeat will match it to an existing record or create a new one.",
      },
      {
        label: "Record a response",
        description:
          "Use the same canvass form — support level, sign request, volunteer interest, and notes.",
      },
    ],
  },
  {
    route: "/canvassing",
    title: "Canvassing",
    summary:
      "Create and manage walk lists, assign canvassers, and track door-knocking progress across your campaign.",
    actions: [
      {
        label: "Create a walk list",
        description:
          "Click New List to build a walk list by street, neighbourhood, tag, or support level.",
      },
      {
        label: "Assign canvassers",
        description:
          "Open a walk list and assign one or more canvassers. They'll see it on their dashboard.",
      },
      {
        label: "Cut turf on a map",
        description:
          "Draw a boundary on the map to auto-generate a walk list from addresses inside it.",
        href: "/canvassing/turf",
      },
      {
        label: "Street Walk mode",
        description:
          "Let canvassers knock doors outside their assigned list by entering any address.",
        href: "/canvassing/street-walk",
      },
    ],
  },

  // ── Operations ─────────────────────────────────────────────────────────────
  {
    route: "/follow-ups",
    title: "Follow-ups",
    summary:
      "Tasks created when a canvasser checks the Follow-up box at a door. Assign them, track progress, and mark them done.",
    actions: [
      {
        label: "Assign a follow-up",
        description:
          "Click any task to assign it to a specific team member for action.",
      },
      {
        label: "Filter by status",
        description:
          "Toggle between Pending and Completed to focus on what still needs attention.",
      },
    ],
  },
  {
    route: "/outreach",
    title: "Outreach Log",
    summary:
      "Track every non-canvassing contact — phone calls, emails, texts, and meetings. All entries appear on the person's timeline.",
    actions: [
      {
        label: "Log a contact",
        description:
          "Click Log Entry to record a phone call, email, text, or in-person meeting with a constituent.",
      },
      {
        label: "Filter by channel",
        description:
          "Use the toolbar to filter by phone, email, text, or in-person contacts.",
      },
    ],
  },
  {
    route: "/events",
    title: "Events",
    summary:
      "Create and manage campaign events — town halls, fundraisers, volunteer meetups. Track RSVPs and attendance.",
    actions: [
      {
        label: "Create an event",
        description:
          "Click New Event and fill in the name, date, location, and description.",
        href: "/events/new",
      },
      {
        label: "Manage attendees",
        description:
          "Open an event to add attendees, track RSVPs, and record guest counts.",
      },
    ],
  },
  {
    route: "/field-messages",
    title: "Field Messages",
    summary:
      "Send broadcast messages to canvassers currently in the field. Messages appear as a banner on the canvass screen.",
    actions: [
      {
        label: "Send a message",
        description:
          "Type your message and hit Send. All active canvassers will see it immediately.",
      },
      {
        label: "When to use this",
        description:
          "Weather warnings, schedule changes, talking point updates, or any real-time alert for your team.",
      },
    ],
  },
  {
    route: "/donors",
    title: "Donors",
    summary:
      "Track donor prospects and donations. Record amounts, status, and thank-you letters without handling payment processing.",
    actions: [
      {
        label: "Add a donor",
        description:
          "Click Add Donor to create a new donor record or link to an existing person in your database.",
      },
      {
        label: "Track donation status",
        description:
          "Move donors through the pipeline: prospect → pledged → received → thanked.",
      },
      {
        label: "Export donor data",
        description:
          "Download donor records as CSV for your finance compliance reporting.",
        href: "/reports/donors",
      },
    ],
  },
  {
    route: "/signs",
    title: "Sign Tracking",
    summary:
      "Manage campaign sign requests and installations. Requests are created automatically when canvassers toggle Sign Request.",
    actions: [
      {
        label: "Update sign status",
        description:
          "Change a sign's status from Requested to Installed or Removed as your team works through the queue.",
      },
      {
        label: "Add a sign manually",
        description:
          "Click Add Sign to create a request for an address that wasn't captured during canvassing.",
      },
    ],
  },

  // ── Analytics & Reports ────────────────────────────────────────────────────
  {
    route: "/analytics",
    title: "Analytics",
    summary:
      "Deeper data views beyond the dashboard — support level trends, canvassing volume over time, and geographic coverage.",
    actions: [
      {
        label: "Support trends",
        description:
          "See how voter identification breaks down over time as your canvassing progresses.",
      },
      {
        label: "Geographic coverage",
        description:
          "Visualise which areas have been canvassed and where gaps remain.",
      },
    ],
  },
  {
    route: "/reports/export",
    title: "Export Data",
    summary:
      "Download your campaign data as CSV files for offline analysis, compliance, or backup.",
    actions: [
      {
        label: "Choose what to export",
        description:
          "Select from People, Walk List Results, Donors, or Volunteers. Only authorized roles can export.",
      },
    ],
  },
  {
    route: "/reports",
    title: "Reports",
    summary:
      "Pre-built reports covering canvassing, support levels, touches, follow-ups, surveys, volunteers, donors, signs, and coverage.",
    actions: [
      {
        label: "Canvassing report",
        description:
          "Doors knocked, outcomes, and response rates across your campaign.",
        href: "/reports/canvassing",
      },
      {
        label: "Support levels",
        description:
          "Breakdown of voter identification — strong yes through strong no.",
        href: "/reports/support-levels",
      },
      {
        label: "Export data",
        description:
          "Download campaign data as CSV for offline analysis or compliance.",
        href: "/reports/export",
      },
    ],
  },

  // ── Leaderboard ────────────────────────────────────────────────────────────
  {
    route: "/leaderboard",
    title: "Leaderboard",
    summary:
      "Ranked list of canvassers by doors knocked. Motivate your team with friendly competition.",
    actions: [
      {
        label: "How it works",
        description:
          "Rankings update in real time as canvassers save responses. Visible to anyone with canvassing access.",
      },
    ],
  },

  // ── Import ─────────────────────────────────────────────────────────────────
  {
    route: "/import/voters",
    title: "Voter List Import",
    summary:
      "Upload your official voter roll (CSV or Excel). The wizard walks you through column mapping, preview, and import.",
    actions: [
      {
        label: "Upload your file",
        description:
          "Drag and drop a CSV or XLSX file, or click to browse. Standard Ontario voter list formats are supported.",
      },
      {
        label: "Map columns",
        description:
          "Match your file's columns to LocalSeat fields — name, address, phone, etc.",
      },
      {
        label: "Review duplicates",
        description:
          "After import, check the duplicate review screen to merge any matches.",
        href: "/people/duplicates",
      },
    ],
  },
  {
    route: "/import/team",
    title: "Team Import",
    summary:
      "Bulk-add team members from a spreadsheet. Upload a CSV or Excel file with name, email, and role columns.",
    actions: [
      {
        label: "Prepare your file",
        description:
          "Your file needs at least: first name, last name, email, and role. Welcome emails are sent automatically.",
      },
    ],
  },
  {
    route: "/import",
    title: "Import & Data",
    summary:
      "Your hub for importing voter lists, team members, and other campaign data. Choose what you need to import.",
    actions: [
      {
        label: "Import voters",
        description:
          "Upload your official voter roll to populate your people database.",
        href: "/import/voters",
      },
      {
        label: "Import team members",
        description:
          "Bulk-add team members from a spreadsheet with roles pre-assigned.",
        href: "/import/team",
      },
    ],
  },

  // ── GOTV ───────────────────────────────────────────────────────────────────
  {
    route: "/gotv",
    title: "Get Out The Vote",
    summary:
      "Election Day mode. Chase identified supporters who haven't voted, coordinate rides, and track real-time turnout.",
    actions: [
      {
        label: "Activate GOTV mode",
        description:
          "Only the campaign manager or candidate can toggle GOTV mode on or off.",
      },
      {
        label: "Poll strike",
        description:
          "Mark supporters as having voted to track turnout progress through the day.",
        href: "/gotv/strike",
      },
      {
        label: "Ride requests",
        description:
          "Flag supporters who need a ride to the polls. Coordinate with your volunteer drivers.",
      },
    ],
  },

  // ── Audit Log ──────────────────────────────────────────────────────────────
  {
    route: "/audit-log",
    title: "Audit Log",
    summary:
      "Every important action in the platform is logged here — data imports, exports, record changes, team changes, and settings updates.",
    actions: [
      {
        label: "Search the log",
        description:
          "Filter by user, action type, or date range to find specific events.",
      },
    ],
  },

  // ── Admin / Campaign Settings ──────────────────────────────────────────────
  {
    route: "/campaign-settings/general",
    title: "General Settings",
    summary:
      "Campaign name, office sought, ballot name, and campaign logo. Only candidates and campaign managers can edit these.",
    actions: [
      {
        label: "Upload a logo",
        description:
          "Add your campaign logo — it appears in the sidebar and on exported reports.",
      },
      {
        label: "Set your ballot name",
        description:
          "The name as it will appear on the ballot. Used in canvassing scripts and materials.",
      },
    ],
  },
  {
    route: "/campaign-settings/ward",
    title: "Ward Boundary",
    summary:
      "View and configure your ward or municipality boundary on the map. This boundary drives out-of-district classification and turf cutting.",
    actions: [
      {
        label: "Set your boundary",
        description:
          "Select your municipality, then adjust the ward boundary if needed. Addresses outside are flagged automatically.",
      },
    ],
  },
  {
    route: "/campaign-settings/competitors",
    title: "Competitors",
    summary:
      "Add other candidates running for the same office. When canvassers record a voter supporting someone else, they select which competitor.",
    actions: [
      {
        label: "Add a competitor",
        description:
          "Enter their name and any notes. They'll appear as options on the canvass screen.",
      },
    ],
  },
  {
    route: "/campaign-settings/script",
    title: "Canvassing Script",
    summary:
      "Write a script that appears at the top of the canvass screen. Give canvassers an opening, talking points, and a closing.",
    actions: [
      {
        label: "Write your script",
        description:
          "Keep it short — a greeting, 2–3 key points, and a friendly close works best.",
      },
    ],
  },
  {
    route: "/campaign-settings/tags",
    title: "Custom Tags",
    summary:
      "Create and manage tags for organizing your people database — Senior, Parent, Environment Issue, and more.",
    actions: [
      {
        label: "Create a tag",
        description:
          "Click Add Tag, choose a name and colour. Apply tags from person detail pages or during import.",
      },
    ],
  },
  {
    route: "/campaign-settings/custom-fields",
    title: "Custom Fields",
    summary:
      "Add custom data fields to person records beyond the standard set. Useful for campaign-specific tracking.",
    actions: [
      {
        label: "Add a field",
        description:
          "Choose a field type (text, number, dropdown, date) and it will appear on every person's detail page.",
      },
    ],
  },
  {
    route: "/campaign-settings/surveys",
    title: "Surveys",
    summary:
      "Create survey questions that appear on the canvass screen during door-knocking. Collect structured data beyond support levels.",
    actions: [
      {
        label: "Create a question",
        description:
          "Add a question and answer options. They'll appear on the canvass form for every door.",
      },
      {
        label: "View results",
        description:
          "See aggregated survey responses in the Survey Results report.",
        href: "/reports/surveys",
      },
    ],
  },
  {
    route: "/campaign-settings/signature-consents",
    title: "Consent Types",
    summary:
      "Configure digital signature consent types for collection during canvassing — nomination endorsements, lawn sign consent, etc.",
    actions: [
      {
        label: "Create a consent type",
        description:
          "Define the consent text and it will appear as a signature option on the canvass screen.",
      },
    ],
  },
  {
    route: "/campaign-settings/privacy",
    title: "Privacy & Data",
    summary:
      "Data retention settings and anonymization tools. Anonymize individual records to comply with privacy requests.",
    actions: [
      {
        label: "Anonymize a record",
        description:
          "Search for a person and anonymize their record. This is permanent and cannot be undone.",
      },
    ],
  },
  {
    route: "/campaign-settings/suppliers",
    title: "Data Suppliers",
    summary:
      "Manage external data supplier accounts. Suppliers upload files through a dedicated portal without accessing campaign data.",
    actions: [
      {
        label: "Invite a supplier",
        description:
          "Enter their email and they'll receive access to the supplier upload portal.",
      },
    ],
  },
  {
    route: "/campaign-settings/imports",
    title: "Data Imports",
    summary:
      "History of all data imports — file names, dates, row counts, and any errors encountered.",
    actions: [
      {
        label: "Review an import",
        description:
          "Click any import to see row-level details, error messages, and which records were created.",
      },
    ],
  },
  {
    route: "/campaign-settings/reports",
    title: "Email Reports",
    summary:
      "Enable daily summary emails so your team gets yesterday's canvassing stats, follow-ups, and key metrics each morning.",
    actions: [
      {
        label: "Enable daily emails",
        description:
          "Toggle on the daily summary and choose which roles receive it.",
      },
    ],
  },
  {
    route: "/campaign-settings",
    title: "Campaign Settings",
    summary:
      "Configure every aspect of your campaign — name, boundary, competitors, tags, surveys, scripts, privacy, and more.",
    actions: [
      {
        label: "General settings",
        description:
          "Campaign name, office, ballot name, and logo.",
        href: "/campaign-settings/general",
      },
      {
        label: "Ward boundary",
        description:
          "Set your geographic boundary for turf cutting and out-of-district flagging.",
        href: "/campaign-settings/ward",
      },
      {
        label: "Custom tags",
        description:
          "Create tags to organise your people database.",
        href: "/campaign-settings/tags",
      },
    ],
  },

  // ── Team ───────────────────────────────────────────────────────────────────
  {
    route: "/team",
    title: "Team Management",
    summary:
      "Invite, manage, and organize your campaign team. Assign roles that control what each person can see and do.",
    actions: [
      {
        label: "Invite a member",
        description:
          "Click Invite and enter their email with an assigned role. They'll get a welcome email with login instructions.",
      },
      {
        label: "Change a role",
        description:
          "Adjust someone's role to give them more or fewer permissions as the campaign evolves.",
      },
      {
        label: "Bulk import team",
        description:
          "Upload a spreadsheet to add many team members at once.",
        href: "/import/team",
      },
    ],
  },

  // ── Data Corrections ───────────────────────────────────────────────────────
  {
    route: "/campaign-settings/data-corrections",
    title: "Data Corrections",
    summary:
      "Review and approve address changes and voter data corrections submitted by team members from the field.",
    actions: [
      {
        label: "Approve or reject",
        description:
          "Review each suggested change, then approve it to update the record or reject it with a reason.",
      },
    ],
  },

  // ── Volunteers ─────────────────────────────────────────────────────────────
  {
    route: "/volunteers/schedule",
    title: "Volunteer Schedule",
    summary:
      "Create and manage volunteer shifts — canvassing, phone banking, events. Assign volunteers and track attendance.",
    actions: [
      {
        label: "Create a shift",
        description:
          "Set the date, time, type, and capacity. Volunteers can be assigned or sign up.",
      },
    ],
  },
  {
    route: "/people/volunteers",
    title: "Volunteers",
    summary:
      "View and manage all volunteers — people who expressed interest during canvassing or were added manually.",
    actions: [
      {
        label: "View volunteer details",
        description:
          "Tap any volunteer to see their availability, skills, and activity history.",
      },
      {
        label: "Manage schedule",
        description:
          "Create and assign volunteer shifts for canvassing, events, or phone banking.",
        href: "/volunteers/schedule",
      },
    ],
  },

  // ── Account ────────────────────────────────────────────────────────────────
  {
    route: "/account/profile",
    title: "Profile",
    summary:
      "Update your name, email, and phone number. These changes apply to your account across all campaigns.",
    actions: [
      {
        label: "Update your info",
        description:
          "Edit your name, email, or phone number and save.",
      },
    ],
  },
  {
    route: "/account/campaigns",
    title: "My Campaigns",
    summary:
      "See all campaigns you belong to. Switch between them or leave a campaign.",
    actions: [
      {
        label: "Switch campaigns",
        description:
          "Click a campaign to make it active. Your role and permissions may differ per campaign.",
      },
    ],
  },
  {
    route: "/account",
    title: "Account",
    summary:
      "Manage your personal profile, view your campaigns, or sign out.",
    actions: [
      {
        label: "Edit profile",
        description:
          "Update your name, email, and phone number.",
        href: "/account/profile",
      },
      {
        label: "My campaigns",
        description:
          "View and switch between campaigns you belong to.",
        href: "/account/campaigns",
      },
    ],
  },

  // ── Supplier Portal ────────────────────────────────────────────────────────
  {
    route: "/supplier-portal",
    title: "Supplier Portal",
    summary:
      "Upload data files for the campaign. You can upload CSV or Excel files which the campaign team will review and import.",
    actions: [
      {
        label: "Upload a file",
        description:
          "Drag and drop or click to browse. Supported formats: CSV and XLSX.",
      },
    ],
  },
];

/**
 * Find the best matching help entry for a given pathname.
 * Uses longest-prefix matching so that `/people/duplicates` beats `/people`.
 */
export function getHelpForRoute(pathname: string): HelpEntry | null {
  let bestMatch: HelpEntry | null = null;
  let bestLength = 0;

  for (const entry of HELP_ENTRIES) {
    if (
      (pathname === entry.route || pathname.startsWith(entry.route + "/")) &&
      entry.route.length > bestLength
    ) {
      bestMatch = entry;
      bestLength = entry.route.length;
    }
  }

  return bestMatch;
}
