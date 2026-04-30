import { parseAddress } from "@/lib/address-parser";
import { parseCsvLine, normaliseKey, parseTagList } from "@/lib/csv-import";
import ExcelJS from "exceljs";

export const TEAM_ROW_CAP = 1_000;

export type TeamRowFields = {
  firstName:    string;
  lastName:     string;
  email:        string;
  role:         string;
  phoneHome:    string;
  phoneMobile:  string;
  streetNumber: string;
  streetName:   string;
  unitNumber:   string;
  city:         string;
  province:     string;
  postalCode:   string;
  tags:         string;
};

export type TeamRowStatus =
  | "ready"
  | "incomplete"
  | "missing_required"
  | "skipped_already_member"
  | "linked_existing_user"
  | "approved"
  | "rejected";

export interface TeamReviewRow {
  id: number;
  originalRowNum: number;
  fields: TeamRowFields;
  missingOnParse: (keyof TeamRowFields)[];
  status: TeamRowStatus;
  rawValues?: Record<string, string>;
  addressAutoParsed?: boolean;
  addressAmbiguous?: boolean;
}

// ── Role validation ──────────────────────────────────────────────────────────

const VALID_ROLE_VALUES = new Set([
  "candidate",
  "campaign_manager",
  "co_chair",
  "field_organizer",
  "canvasser",
  "volunteer_coordinator",
  "finance_lead",
  "sign_installer",
]);

function normalizeRoleString(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isValidRoleString(raw: string): boolean {
  if (!raw) return false;
  return VALID_ROLE_VALUES.has(normalizeRoleString(raw));
}

// ── Sample row detection ─────────────────────────────────────────────────────

const SAMPLE_EMAILS = new Set([
  "jane.doe@example.com",
  "john.smith@example.com",
  "maria.garcia@example.com",
]);

function detectWarningRow(firstCell: string): boolean {
  const lower = firstCell.toLowerCase();
  return firstCell.startsWith("***") || lower.includes("delete this row");
}

// ── Field helpers ────────────────────────────────────────────────────────────

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[normaliseKey(k)];
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

// ── Row builder ──────────────────────────────────────────────────────────────

export function buildTeamReviewRow(
  raw: Record<string, string>,
  originalRowNum: number,
  id: number,
): TeamReviewRow {
  const explicitNum  = getField(raw, "streetnumber", "street_number", "streetno");
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

  const fields: TeamRowFields = {
    firstName:   getField(raw, "firstname", "first_name", "first"),
    lastName:    getField(raw, "lastname", "last_name", "last"),
    email:       getField(raw, "email", "emailaddress", "email_address"),
    role:        getField(raw, "role"),
    phoneHome:   getField(raw, "phonehome", "phone_home", "phone", "phonenumber", "phone_number", "tel"),
    phoneMobile: getField(raw, "phonemobile", "phone_mobile", "mobile", "cell", "cellphone"),
    streetNumber,
    streetName,
    unitNumber,
    city:        getField(raw, "city"),
    province:    getField(raw, "province", "prov"),
    postalCode:  getField(raw, "postalcode", "postal_code", "postal", "zip"),
    tags:        getField(raw, "tags", "taglist", "tag"),
  };

  const missingOnParse = getMissingRequiredFields(fields);
  const status: TeamRowStatus = missingOnParse.length === 0 ? "ready" : "missing_required";

  return {
    id,
    originalRowNum,
    fields,
    missingOnParse,
    status,
    ...(addressAutoParsed ? { addressAutoParsed } : {}),
    ...(addressAmbiguous  ? { addressAmbiguous  } : {}),
  };
}

function getMissingRequiredFields(fields: TeamRowFields): (keyof TeamRowFields)[] {
  const missing: (keyof TeamRowFields)[] = [];
  if (!fields.firstName)  missing.push("firstName");
  if (!fields.lastName)   missing.push("lastName");
  if (!fields.email)      missing.push("email");
  if (!fields.role)       missing.push("role");
  if (!fields.phoneHome && !fields.phoneMobile) missing.push("phoneHome");
  return missing;
}

// ── Classification ───────────────────────────────────────────────────────────

export function classifyTeamRow(row: TeamReviewRow): "ready" | "incomplete" | "missing_required" {
  if (row.status === "skipped_already_member" || row.status === "linked_existing_user") return "ready";
  if (row.status === "rejected") return "missing_required";

  const f = row.fields;
  const mandatoryMissing = !f.firstName || !f.lastName || !f.email || !f.role;
  const hasAnyPhone = Boolean(f.phoneHome || f.phoneMobile);
  const roleInvalid = Boolean(f.role) && !isValidRoleString(f.role);
  if (mandatoryMissing || !hasAnyPhone || roleInvalid) return "missing_required";

  // Address is fully optional — partial or full address → ready.
  // Only "no address at all" stays incomplete (surfaced as a warning in the UI, still imported).
  const hasAnyAddress = Boolean(f.streetNumber || f.streetName || f.city || f.postalCode);
  return hasAnyAddress ? "ready" : "incomplete";
}

export function listMissingTeamFields(row: TeamReviewRow): string[] {
  const f = row.fields;
  const out: string[] = [];
  if (!f.firstName)  out.push("FirstName");
  if (!f.lastName)   out.push("LastName");
  if (!f.email)      out.push("Email");
  if (!f.role)                    out.push("Role");
  else if (!isValidRoleString(f.role)) out.push(`Role (invalid: "${f.role.trim()}")`);
  if (!f.phoneHome && !f.phoneMobile) out.push("Phone");
  // Address is optional — no "Address" entry here.
  return out;
}

// ── CSV parser ───────────────────────────────────────────────────────────────

export function parseTeamCsvToReviewRows(text: string): {
  rows: TeamReviewRow[];
  fileError: string | null;
  originalHeaders: string[];
} {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) {
    return {
      rows: [],
      fileError: "File must have a header row and at least one data row.",
      originalHeaders: [],
    };
  }

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map(normaliseKey);

  // Scan first 5 data rows for warning marker
  for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const firstCell = (values[0] ?? "").trim();
    if (detectWarningRow(firstCell)) {
      return {
        rows: [],
        fileError:
          "Sample rows are still in your file. Delete the warning row and the 3 sample rows (Jane Doe, John Smith, Maria Garcia), then upload again.",
        originalHeaders: [],
      };
    }
  }

  const dataRowCount = lines.slice(1).filter((l) => l.trim()).length;
  if (dataRowCount > TEAM_ROW_CAP) {
    return {
      rows: [],
      fileError: `File has ${dataRowCount.toLocaleString()} rows — the maximum is ${TEAM_ROW_CAP.toLocaleString()}. Split your file into smaller batches and upload each separately.`,
      originalHeaders: [],
    };
  }

  const rows: TeamReviewRow[] = [];
  let id = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = values[idx] ?? ""; });

    const rawValues: Record<string, string> = {};
    rawHeaders.forEach((h, idx) => { rawValues[h] = (values[idx] ?? "").trim(); });

    const row = buildTeamReviewRow(raw, i + 1, id++);
    row.rawValues = rawValues;
    rows.push(row);
  }

  if (rows.length === 0) {
    return {
      rows: [],
      fileError: "No data rows found after the header.",
      originalHeaders: [],
    };
  }

  if (rows.some((r) => SAMPLE_EMAILS.has(r.fields.email.toLowerCase()))) {
    return {
      rows: [],
      fileError:
        "Sample rows still in file. Delete jane.doe@example.com, john.smith@example.com, and maria.garcia@example.com rows.",
      originalHeaders: [],
    };
  }

  return { rows, fileError: null, originalHeaders: rawHeaders };
}

// ── XLSX helpers ─────────────────────────────────────────────────────────────

function cellToString(cell: ExcelJS.Cell): string {
  const { value } = cell;
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !isNaN(value.getTime())) return String(value);
  if (typeof value === "object") {
    if ("richText" in value) {
      return (value as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    }
    if ("result" in value) {
      const r = (value as ExcelJS.CellFormulaValue).result;
      return r !== null && r !== undefined ? String(r) : "";
    }
    if ("text" in value) return String((value as ExcelJS.CellHyperlinkValue).text);
    return String(value);
  }
  return String(value);
}

// ── XLSX parser ──────────────────────────────────────────────────────────────

export async function parseXlsxToTeamReviewRows(file: File): Promise<{
  rows: TeamReviewRow[];
  fileError: string | null;
  originalHeaders: string[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return {
      rows: [],
      fileError: "Could not read the XLSX file. Make sure it is a valid .xlsx file.",
      originalHeaders: [],
    };
  }

  let sheet: ExcelJS.Worksheet | undefined;
  workbook.eachSheet((ws) => {
    if (!sheet && ws.state !== "veryHidden" && ws.name !== "_Lists") {
      sheet = ws;
    }
  });

  if (!sheet) {
    return {
      rows: [],
      fileError: "No readable worksheet found in the file.",
      originalHeaders: [],
    };
  }

  const headerRow = sheet.getRow(1);
  const rawHeaders: string[] = [];
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    const raw = cellToString(cell);
    rawHeaders.push(raw);
    headers.push(normaliseKey(raw));
  });

  if (headers.length === 0) {
    return {
      rows: [],
      fileError: "File must have a header row and at least one data row.",
      originalHeaders: [],
    };
  }

  // Check first 5 data rows (rows 2-6) for warning marker
  for (let rowNum = 2; rowNum <= 6; rowNum++) {
    const row = sheet.getRow(rowNum);
    const firstCell = cellToString(row.getCell(1)).trim();
    if (!firstCell) continue;
    if (detectWarningRow(firstCell)) {
      return {
        rows: [],
        fileError:
          "Sample rows are still in your file. Delete the warning row and the 3 sample rows (Jane Doe, John Smith, Maria Garcia), then upload again.",
        originalHeaders: [],
      };
    }
  }

  const dataRowCount = (sheet.rowCount ?? 0) - 1;
  if (dataRowCount > TEAM_ROW_CAP) {
    return {
      rows: [],
      fileError: `File has ${dataRowCount.toLocaleString()} rows — the maximum is ${TEAM_ROW_CAP.toLocaleString()}. Split your file into smaller batches and upload each separately.`,
      originalHeaders: [],
    };
  }

  const rows: TeamReviewRow[] = [];
  let id = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = cellToString(row.getCell(idx + 1)).trim();
    });

    if (Object.values(raw).every((v) => v === "")) return;

    const rawValues: Record<string, string> = {};
    rawHeaders.forEach((h, idx) => {
      rawValues[h] = cellToString(row.getCell(idx + 1)).trim();
    });

    const reviewRow = buildTeamReviewRow(raw, rowNumber, id++);
    reviewRow.rawValues = rawValues;
    rows.push(reviewRow);
  });

  if (rows.length === 0) {
    return {
      rows: [],
      fileError: "No data rows found after the header.",
      originalHeaders: [],
    };
  }

  if (rows.some((r) => SAMPLE_EMAILS.has(r.fields.email.toLowerCase()))) {
    return {
      rows: [],
      fileError:
        "Sample rows still in file. Delete jane.doe@example.com, john.smith@example.com, and maria.garcia@example.com rows.",
      originalHeaders: [],
    };
  }

  return { rows, fileError: null, originalHeaders: rawHeaders };
}

export { parseTagList };
