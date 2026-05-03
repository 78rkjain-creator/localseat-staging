/**
 * Shared CSV parsing utilities used by the voter-list import modal.
 * Supports all columns in the voter-list template.
 */

import type { SupportLevel } from "@/types";
import { SUPPORT_LEVEL_VALUES } from "@/types";
import { parseAddress } from "./address-parser";

export const VOTER_LIST_ROW_CAP = 10_000;

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
  supportLevel: string;
  tags: string;
  notes: string;
  gender: string;
  isConfirmedVoter: string;
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
  firstName:        "First name",
  lastName:         "Last name",
  streetNumber:     "Street #",
  streetName:       "Street name",
  unitNumber:       "Unit",
  city:             "City",
  province:         "Province",
  postalCode:       "Postal code",
  phoneHome:        "Phone (home)",
  phoneMobile:      "Phone (mobile)",
  email:            "Email",
  birthDate:        "Birth date",
  pollNumber:       "Poll #",
  voterId:          "Voter ID",
  supportLevel:     "Support level",
  tags:             "Tags",
  notes:            "Notes",
  gender:           "Gender",
  isConfirmedVoter: "Confirmed voter",
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
  /** true if address came from a single "Address" column and was auto-parsed */
  addressAutoParsed?: boolean;
  /** true if the address parser couldn't confidently parse the combined address */
  addressAmbiguous?: boolean;
  /** Original CSV/XLSX cell values keyed by original (un-normalized) header string */
  rawValues?: Record<string, string>;
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

export function normaliseKey(s: string): string {
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

// ── Normalisation helpers ──────────────────────────────────────────────────

export function normaliseSupportLevel(raw: string): SupportLevel | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const collapsed = cleaned.replace(/_/g, "");
  for (const v of SUPPORT_LEVEL_VALUES) {
    if (cleaned === v) return v;
    if (collapsed === v.replace(/_/g, "")) return v;
  }
  return null;
}

export function parseImportBoolean(raw: string): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "yes" || v === "y" ||
         v === "1"    || v === "x";
}

export function parseTagList(raw: string): string[] {
  if (!raw) return [];
  const parts = raw.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(p); }
  }
  return out;
}

// ── Row builder (shared between CSV and XLSX parsers) ──────────────────────

export function buildReviewRow(
  raw: Record<string, string>,
  originalRowNum: number,
  id: number,
  customFields?: CustomFieldDef[],
): { row: ReviewRow; bumpedBirthYearWarning: boolean } {
  const customFieldMap: { normLabel: string; id: string }[] =
    customFields?.map((f) => ({ normLabel: normaliseKey(f.label), id: f.id })) ?? [];

  let bumpedBirthYearWarning = false;

  // Address: prefer explicit columns. If empty, try a single "Address"
  // column and parse it.
  const explicitNum  = getField(raw, "streetnumber", "street_number", "streetno", "number");
  const explicitName = getField(raw, "streetname", "street_name", "street");
  const explicitUnit = getField(raw, "unitnumber", "unit_number", "unit", "apt", "suite");
  const combinedAddr = getField(raw, "address", "addr", "streetaddress", "street_address");

  let streetNumber = explicitNum;
  let streetName   = explicitName;
  let unitNumber   = explicitUnit;
  let addressAutoParsed = false;
  let addressAmbiguous  = false;

  if (!streetNumber && !streetName && combinedAddr) {
    const parsed = parseAddress(combinedAddr);
    streetNumber = parsed.num;
    streetName   = parsed.name;
    if (!unitNumber) unitNumber = parsed.unit;
    addressAutoParsed = true;
    addressAmbiguous  = parsed.ambiguous;
  }

  const fields: RowFields = {
    firstName:    getField(raw, "firstname", "first_name", "first"),
    lastName:     getField(raw, "lastname", "last_name", "last"),
    streetNumber,
    streetName,
    unitNumber,
    city:         getField(raw, "city"),
    province:     getField(raw, "province", "prov"),
    postalCode:   getField(raw, "postalcode", "postal_code", "postal", "zip"),
    phoneHome:    getField(raw, "phone", "phonehome", "phone_home", "phonenumber", "phone_number", "tel"),
    phoneMobile:  getField(raw, "mobile", "cell", "cellphone", "mobilephon", "phone_mobile", "phonemobile"),
    email:        getField(raw, "email", "emailaddress", "email_address"),
    birthDate:    (() => {
      const direct = getField(raw, "birthdate", "birth_date", "dateofbirth");
      if (direct) return direct;
      const yearStr = getField(raw, "birthyear", "birth_year", "yearofbirth");
      if (yearStr && /^\d{4}$/.test(yearStr.trim())) {
        bumpedBirthYearWarning = true;
        return `${yearStr.trim()}-01-01`;
      }
      return "";
    })(),
    pollNumber:       getField(raw, "pollnumber", "poll_number", "poll", "pollno", "poll_no"),
    voterId:          getField(raw, "voterid", "voter_id", "voteridentifier", "electorid", "elector_id"),
    supportLevel:     getField(raw, "supportlevel", "support_level", "support", "level"),
    tags:             getField(raw, "tags", "taglist", "tag"),
    notes:            getField(raw, "notes", "note", "comment", "comments"),
    gender:           getField(raw, "gender", "sex"),
    isConfirmedVoter: getField(raw, "confirmedvoter", "confirmed_voter", "confirmed", "isconfirmedvoter"),
  };

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

  return {
    row: {
      id,
      originalRowNum,
      fields,
      missingOnParse,
      status,
      customFieldValues,
      ...(addressAutoParsed ? { addressAutoParsed } : {}),
      ...(addressAmbiguous  ? { addressAmbiguous  } : {}),
    },
    bumpedBirthYearWarning,
  };
}

// ── Bucket classification ──────────────────────────────────────────────────

export type ReviewBucket = "ready" | "incomplete" | "duplicate" | "missing_required";

export function classifyRow(row: ReviewRow): ReviewBucket {
  if (row.status === "duplicate") return "duplicate";
  if (row.status === "rejected") return "missing_required";
  if (row.status === "approved") return "ready";

  const f = row.fields;
  const mandatoryMissing = !f.firstName || !f.lastName || !f.city || !f.province || !f.postalCode;
  if (mandatoryMissing) return "missing_required";

  const hasEmail = Boolean(f.email);
  const hasAddress = Boolean(f.streetNumber && f.streetName);
  if (hasEmail && hasAddress) return "ready";
  return "incomplete";
}

export function listMissingFields(row: ReviewRow): string[] {
  const f = row.fields;
  const out: string[] = [];
  if (!f.firstName)  out.push("FirstName");
  if (!f.lastName)   out.push("LastName");
  if (!f.city)       out.push("City");
  if (!f.province)   out.push("Province");
  if (!f.postalCode) out.push("PostalCode");
  if (!f.email)      out.push("Email");
  if (!f.streetNumber || !f.streetName) out.push("Address");
  return out;
}

// ── CSV parser ─────────────────────────────────────────────────────────────

export function parseCsvToReviewRows(
  text: string,
  customFields?: CustomFieldDef[],
  options?: { skipRowCap?: boolean },
): {
  rows: ReviewRow[];
  fileError: string | null;
  birthYearWarningCount: number;
  originalHeaders: string[];
  rowCapExceeded?: boolean;
} {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) {
    return {
      rows: [],
      fileError: "File must have a header row and at least one data row.",
      birthYearWarningCount: 0,
      originalHeaders: [],
    };
  }

  const dataRowCount = lines.slice(1).filter((l) => l.trim()).length;
  if (!options?.skipRowCap && dataRowCount > VOTER_LIST_ROW_CAP) {
    return {
      rows: [],
      fileError: `File has ${dataRowCount.toLocaleString()} rows — the maximum is ${VOTER_LIST_ROW_CAP.toLocaleString()}.`,
      birthYearWarningCount: 0,
      originalHeaders: [],
      rowCapExceeded: true,
    };
  }

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map(normaliseKey);
  const rows: ReviewRow[] = [];
  let id = 0;
  let birthYearWarningCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = values[idx] ?? ""; });

    const rawValues: Record<string, string> = {};
    rawHeaders.forEach((h, idx) => { rawValues[h] = (values[idx] ?? "").trim(); });

    const { row, bumpedBirthYearWarning } = buildReviewRow(raw, i + 1, id++, customFields);
    row.rawValues = rawValues;
    if (bumpedBirthYearWarning) birthYearWarningCount++;
    rows.push(row);
  }

  if (rows.length === 0) {
    return { rows: [], fileError: "No data rows found after the header.", birthYearWarningCount: 0, originalHeaders: [] };
  }

  return { rows, fileError: null, birthYearWarningCount, originalHeaders: rawHeaders };
}
