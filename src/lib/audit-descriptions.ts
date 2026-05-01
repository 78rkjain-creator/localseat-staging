/**
 * Plain-English descriptions for audit log entries.
 *
 * `formatAuditDescription` converts a raw action code + metadata into a
 * human-readable sentence for display in the audit log UI and CSV export.
 *
 * Rules:
 * - Never throws — all metadata access is guarded against missing/null values.
 * - Descriptions are generated at read/export time; nothing is stored in the DB.
 * - For unknown action codes, falls back to a title-cased version of the code.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(val: unknown): string {
  if (val == null) return "";
  return String(val);
}

function count(val: unknown): string {
  if (val == null) return "?";
  const n = Number(val);
  if (isNaN(n)) return "?";
  return n.toLocaleString("en-CA");
}

function plural(n: unknown, singular = "record"): string {
  const num = Number(n);
  return `${count(n)} ${singular}${!isNaN(num) && num !== 1 ? "s" : ""}`;
}

function formatRole(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Convert SOME_ACTION_CODE → "Some action code" (title-case first word, rest lower). */
export function formatActionCode(action: string): string {
  const words = action.split("_").map((w) => w.toLowerCase());
  if (words.length === 0) return action;
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Returns a plain-English sentence describing an audit log entry.
 *
 * @param action    Raw action code stored in the DB (e.g. "EXPORT_VOTER_LIST")
 * @param metadata  Parsed `after` JSON from the audit log row, or null
 * @param actorName Display name of the user who performed the action
 */
export function formatAuditDescription(
  action: string,
  metadata: Record<string, unknown> | null,
  actorName: string
): string {
  const m = metadata ?? {};
  const actor = actorName || "Unknown user";

  switch (action) {
    // ── Authentication ──────────────────────────────────────────────────────
    case "LOGIN":
      return `${actor} signed in`;

    case "LOGOUT":
      return `${actor} signed out`;

    case "TERMS_ACCEPTED": {
      const version = str(m.version ?? m.termsVersion);
      const signedAs = str(m.signedName ?? m.signedAs);
      const base = `${actor} accepted the Terms and Conditions`;
      if (version && signedAs) return `${base} (${version}) and signed as ${signedAs}`;
      if (version) return `${base} (${version})`;
      return base;
    }

    case "PASSWORD_RESET_REQUESTED": {
      const email = str(m.email ?? m.targetEmail);
      if (email) return `${actor} sent a password reset link to ${email}`;
      return `${actor} requested a password reset`;
    }

    case "PASSWORD_RESET_COMPLETED":
      return `${actor} completed a password reset`;

    // ── Canvassing ──────────────────────────────────────────────────────────
    case "CANVASS_RESPONSE_SAVED": {
      const personName = str(m.personName ?? m.personFirstName);
      const level = str(m.supportLevel);
      if (personName && level) return `${actor} recorded a canvass response for ${personName} — ${level}`;
      if (personName) return `${actor} recorded a canvass response for ${personName}`;
      return `${actor} recorded a canvass response`;
    }

    case "CANVASS_LIST_CREATED": {
      const listName = str(m.listName ?? m.name);
      if (listName) return `${actor} created walk list ${listName}`;
      return `${actor} created a walk list`;
    }

    // ── People / voter data ─────────────────────────────────────────────────
    case "NOTE_ADDED": {
      const personName = str(m.personName);
      if (personName) return `${actor} added a note to ${personName}'s record`;
      return `${actor} added a note`;
    }

    case "VOTER_IMPORT_COMPLETED":
    case "VOTER_LIST_IMPORTED": {
      const created = Number(m.created) || 0;
      const importSource = str(m.importSource);
      const base = `${actor} imported ${created.toLocaleString("en-CA")} voter record${created !== 1 ? "s" : ""}`;
      if (importSource) return `${base} — source: ${importSource}`;
      return base;
    }

    case "PERSON_MERGED":
      return `${actor} merged a duplicate voter record`;

    // ── Follow-ups ──────────────────────────────────────────────────────────
    case "FOLLOW_UP_CREATED": {
      const personName = str(m.personName);
      if (personName) return `${actor} created a follow-up task for ${personName}`;
      return `${actor} created a follow-up task`;
    }

    case "FOLLOW_UP_COMPLETED": {
      const personName = str(m.personName);
      if (personName) return `${actor} marked a follow-up complete for ${personName}`;
      return `${actor} marked a follow-up complete`;
    }

    // ── Address changes ─────────────────────────────────────────────────────
    case "ADDRESS_CHANGE_APPROVED": {
      const personName = str(m.personName);
      const newAddress = str(m.newAddress);
      if (personName && newAddress) return `${actor} approved an address change for ${personName} — moved to ${newAddress}`;
      if (personName) return `${actor} approved an address change for ${personName}`;
      return `${actor} approved an address change`;
    }

    case "ADDRESS_CHANGE_REJECTED": {
      const personName = str(m.personName);
      if (personName) return `${actor} rejected an address change request for ${personName}`;
      return `${actor} rejected an address change request`;
    }

    case "ADDRESS_CHANGE_SUBMITTED": {
      const personName = str(m.personName);
      if (personName) return `${actor} submitted an address change request for ${personName}`;
      return `${actor} submitted an address change request`;
    }

    // ── Campaign-level exports ──────────────────────────────────────────────
    case "EXPORT_VOTER_LIST":
      return `${actor} exported the voter list — ${plural(m.rowCount)}`;

    case "EXPORT_WALK_LIST": {
      const listName = str(m.filters && typeof m.filters === "object"
        ? (m.filters as Record<string, unknown>).listName
        : null);
      const base = `${actor} exported the walk list`;
      return listName
        ? `${base} "${listName}" — ${plural(m.rowCount)}`
        : `${base} — ${plural(m.rowCount)}`;
    }

    case "EXPORT_DONORS":
      return `${actor} exported the donor list — ${plural(m.rowCount)}`;

    case "EXPORT_VOLUNTEERS":
      return `${actor} exported the volunteer list — ${plural(m.rowCount)}`;

    case "EXPORT_OUTREACH":
      return `${actor} exported outreach history — ${plural(m.rowCount)}`;

    // ── Admin / platform exports ────────────────────────────────────────────
    case "EXPORT_ADMIN_VOTERS":
      return `${actor} exported Voters from the admin panel — ${plural(m.rowCount)}`;

    case "EXPORT_ADMIN_CAMPAIGNS":
      return `${actor} exported Campaigns from the admin panel — ${plural(m.rowCount)}`;

    case "EXPORT_ADMIN_USERS":
      return `${actor} exported Users from the admin panel — ${plural(m.rowCount)}`;

    case "EXPORT_AUDIT_LOG":
      return `${actor} exported the audit log — ${plural(m.rowCount)}`;

    case "ADMIN_EXPORT": {
      // Legacy action code — exportType stored in metadata distinguishes the type
      const exportType = str(m.exportType);
      const label = exportType
        ? exportType.charAt(0).toUpperCase() + exportType.slice(1).replace(/_/g, " ")
        : "data";
      return `${actor} exported ${label} from the admin panel — ${plural(m.rowCount)}`;
    }

    // ── Team / user management ──────────────────────────────────────────────
    case "MEMBER_ADDED": {
      const memberName = str(m.memberName ?? m.name);
      const role = str(m.role);
      if (memberName && role) return `${actor} added ${memberName} to the campaign as ${formatRole(role)}`;
      if (memberName) return `${actor} added ${memberName} to the campaign`;
      return `${actor} added a member to the campaign`;
    }

    case "MEMBER_REMOVED": {
      const memberName = str(m.memberName ?? m.name);
      if (memberName) return `${actor} removed ${memberName} from the campaign`;
      return `${actor} removed a member from the campaign`;
    }

    case "ROLE_CHANGED": {
      const memberName = str(m.memberName ?? m.name);
      const newRole = str(m.newRole ?? m.role);
      if (memberName && newRole) return `${actor} changed ${memberName}'s role to ${formatRole(newRole)}`;
      if (memberName) return `${actor} changed ${memberName}'s role`;
      return `${actor} changed a member's role`;
    }

    case "USER_HARD_DELETED": {
      const email = str(m.email ?? m.targetEmail);
      if (email) return `${actor} permanently deleted user ${email}`;
      return `${actor} permanently deleted a user`;
    }

    case "USER_DEACTIVATED": {
      const email = str(m.email ?? m.targetEmail);
      if (email) return `${actor} deactivated user ${email}`;
      return `${actor} deactivated a user`;
    }

    case "USER_REACTIVATED": {
      const email = str(m.email ?? m.targetEmail);
      if (email) return `${actor} reactivated user ${email}`;
      return `${actor} reactivated a user`;
    }

    // ── Support access ──────────────────────────────────────────────────────
    case "SUPPORT_ACCESS_REQUESTED":
      return `${actor} requested temporary support access to the campaign`;

    case "SUPPORT_ACCESS_APPROVED": {
      const expires = str(m.expiresAt);
      if (expires) return `${actor} approved support access (expires ${new Date(expires).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })})`;
      return `${actor} approved support access`;
    }

    case "SUPPORT_ACCESS_DENIED":
      return `${actor} denied the support access request`;

    case "SUPPORT_ACCESS_REVOKED":
      return `${actor} revoked active support access`;

    case "SUPPORT_ACCESS_CANCELLED":
      return `${actor} cancelled the support access request`;

    case "SUPPORT_SESSION_ENTERED_READONLY":
      return `${actor} viewed the campaign in read-only support mode`;

    case "SUPPORT_SESSION_ENTERED_FULL":
      return `${actor} entered the campaign with full support access`;

    case "CANDIDATE_ROLE_TRANSFERRED": {
      const newRole = str(m.newRole);
      return newRole === "candidate"
        ? `${actor} received the candidate role (admin transfer)`
        : `${actor} relinquished the candidate role — reassigned to ${formatRole(newRole)}`;
    }

    case "CANDIDATE_ROLE_RELINQUISHED": {
      const newRole = str(m.newRole);
      if (newRole) return `${actor} had the candidate role transferred — now ${formatRole(newRole)}`;
      return `${actor} had the candidate role transferred`;
    }

    case "CAMPAIGN_OVERRIDE_UPDATED":
      return `${actor} updated the campaign plan override`;

    case "CAMPAIGN_DEACTIVATED":
      return `${actor} deactivated the campaign`;

    case "CAMPAIGN_REACTIVATED":
      return `${actor} reactivated the campaign`;

    case "CAMPAIGN_DELETED":
      return `${actor} soft-deleted the campaign`;

    case "CAMPAIGN_RESTORED":
      return `${actor} restored the deleted campaign`;

    case "FORCE_LOGOUT_ALL":
      return `${actor} force-logged out all users (session version bumped globally)`;

    case "PLATFORM_SETTINGS_UPDATED": {
      const changed = m.changed;
      if (changed && typeof changed === "object") {
        const keys = Object.keys(changed as Record<string, unknown>);
        if (keys.length === 1 && keys[0] === "maintenance_mode") {
          const to = (changed as Record<string, { to: string }>)["maintenance_mode"]?.to;
          return to === "true"
            ? `${actor} enabled maintenance mode`
            : `${actor} disabled maintenance mode`;
        }
        if (keys.length > 0) {
          return `${actor} updated platform settings (${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "…" : ""})`;
        }
      }
      return `${actor} updated platform settings`;
    }

    // ── Fallback ────────────────────────────────────────────────────────────
    default:
      return formatActionCode(action);
  }
}
