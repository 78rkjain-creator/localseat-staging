/**
 * Shared CSV parsing utilities used by the voter-list import modal.
 * Supports all 11 columns in the voter-list template.
 */

export interface RowFields {
  firstName: string;
  lastName: string;
  streetNumber: string;
  streetName: string;
  unitNumber: string;
  city: string;
  province: string;
  postalCode: string;
  phoneHome: string;
  phoneMobile: string;
  email: string;
  birthDate: string;
  pollNumber: string;
  voterId: string;
}

export const MANDATORY_FIELDS: (keyof RowFields)[] = [
  "firstName",
  "lastName",
  "streetNumber",
  "streetName",
  "city",
  "province",
  "postalCode",
];

export const FIELD_LABELS: Record<keyof RowFields, string> = {
  firstName:    "First name",
  lastName:     "Last name",
  streetNumber: "Street #",
  streetName:   "Street name",
  unitNumber:   "Unit",
  city:         "City",
  province:     "Province",
  postalCode:   "Postal code",
  phoneHome:    "Phone (home)",
  phoneMobile:  "Phone (mobile)",
  email:        "Email",
  birthDate:    "Birth date",
  pollNumber:   "Poll #",
  voterId:      "Voter ID",
};

export type RowStatus = "ready" | "flagged" | "approved" | "rejected" | "duplicate";

export interface ReviewRow {
  id: number;
  originalRowNum: number;
  fields: RowFields;
  missingOnParse: (keyof RowFields)[];
  status: RowStatus;
  /** Name of the existing person this row likely duplicates, if detected. */
  duplicateOf?: string;
  /** Custom field values keyed by field id, extracted from matching CSV columns. */
  customFieldValues?: Record<string, string>;
}

// ── Parsing helpers ────────────────────────────────────────────────────────

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { fields.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  fields.push(current.trim());
  return fields;
}

function normaliseKey(s: string): string {
  return s.toLowerCase().replace(/[\s_-]/g, "");
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[normaliseKey(k)];
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

export function getMissingFields(fields: RowFields): (keyof RowFields)[] {
  return MANDATORY_FIELDS.filter((f) => !fields[f].trim());
}

export interface CustomFieldDef {
  id: string;
  label: string;
}

export function parseCsvToReviewRows(
  text: string,
  customFields?: CustomFieldDef[]
): {
  rows: ReviewRow[];
  fileError: string | null;
  birthYearWarningCount: number;
} {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) {
    return {
      rows: [],
      fileError: "File must have a header row and at least one data row.",
      birthYearWarningCount: 0,
    };
  }

  const headers = parseCsvLine(lines[0]).map(normaliseKey);
  const rows: ReviewRow[] = [];
  let id = 0;
  let birthYearWarningCount = 0;

  // Build a lookup from normalised label → field id for custom fields
  const customFieldMap: { normLabel: string; id: string }[] =
    customFields?.map((f) => ({ normLabel: normaliseKey(f.label), id: f.id })) ?? [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = values[idx] ?? ""; });

    const fields: RowFields = {
      firstName:    getField(raw, "firstname", "first_name", "first"),
      lastName:     getField(raw, "lastname", "last_name", "last"),
      streetNumber: getField(raw, "streetnumber", "street_number", "streetno", "number"),
      streetName:   getField(raw, "streetname", "street_name", "street"),
      unitNumber:   getField(raw, "unitnumber", "unit_number", "unit", "apt", "suite"),
      city:         getField(raw, "city"),
      province:     getField(raw, "province", "prov"),
      postalCode:   getField(raw, "postalcode", "postal_code", "postal", "zip"),
      phoneHome:    getField(raw, "phone", "phonehome", "phone_home", "phonenumber", "phone_number", "tel"),
      phoneMobile:  getField(raw, "mobile", "cell", "cellphone", "mobilephon", "phone_mobile", "phonemobile"),
      email:        getField(raw, "email", "emailaddress", "email_address"),
      birthDate:    (() => {
        const direct = getField(raw, "birthdate", "birth_date", "dateofbirth");
        if (direct) return direct;
        // Backward compat: accept a bare birth year (YYYY) and convert to YYYY-01-01
        const yearStr = getField(raw, "birthyear", "birth_year", "yearofbirth");
        if (yearStr && /^\d{4}$/.test(yearStr.trim())) {
          birthYearWarningCount++;
          return `${yearStr.trim()}-01-01`;
        }
        return "";
      })(),
      pollNumber:   getField(raw, "pollnumber", "poll_number", "poll", "pollno", "poll_no"),
      voterId:      getField(raw, "voterid", "voter_id", "voteridentifier", "electorid", "elector_id"),
    };

    // Extract custom field values by matching CSV header labels to field definitions
    let customFieldValues: Record<string, string> | undefined;
    if (customFieldMap.length > 0) {
      const cfv: Record<string, string> = {};
      for (const cf of customFieldMap) {
        const val = raw[cf.normLabel];
        if (val !== undefined && val !== "") cfv[cf.id] = val;
      }
      if (Object.keys(cfv).length > 0) customFieldValues = cfv;
    }

    const missingOnParse = MANDATORY_FIELDS.filter((f) => !fields[f]);
    const status: RowStatus = missingOnParse.length === 0 ? "ready" : "flagged";

    rows.push({ id: id++, originalRowNum: i + 1, fields, missingOnParse, status, customFieldValues });
  }

  if (rows.length === 0) {
    return { rows: [], fileError: "No data rows found after the header.", birthYearWarningCount: 0 };
  }

  return { rows, fileError: null, birthYearWarningCount };
}
