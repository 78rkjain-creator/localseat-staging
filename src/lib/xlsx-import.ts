import ExcelJS from "exceljs";
import { buildReviewRow, normaliseKey, VOTER_LIST_ROW_CAP } from "./csv-import";
import type { ReviewRow, CustomFieldDef } from "./csv-import";

function formatDate(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

function cellToString(cell: ExcelJS.Cell): string {
  const { value } = cell;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "object") {
    // RichText or shared formula
    if ("richText" in value) {
      return (value as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    }
    if ("result" in value) {
      const r = (value as ExcelJS.CellFormulaValue).result;
      if (r instanceof Date) return formatDate(r);
      return r !== null && r !== undefined ? String(r) : "";
    }
    if ("text" in value) return String((value as ExcelJS.CellHyperlinkValue).text);
    return String(value);
  }
  return String(value);
}

export async function parseXlsxToReviewRows(
  file: File,
  customFields?: CustomFieldDef[],
): Promise<{
  rows: ReviewRow[];
  fileError: string | null;
  birthYearWarningCount: number;
  originalHeaders: string[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return { rows: [], fileError: "Could not read the XLSX file. Make sure it is a valid .xlsx file.", birthYearWarningCount: 0, originalHeaders: [] };
  }

  // Pick first non-hidden worksheet (skip _Lists)
  let sheet: ExcelJS.Worksheet | undefined;
  workbook.eachSheet((ws) => {
    if (!sheet && ws.state !== "veryHidden" && ws.name !== "_Lists") {
      sheet = ws;
    }
  });

  if (!sheet) {
    return { rows: [], fileError: "No readable worksheet found in the file.", birthYearWarningCount: 0, originalHeaders: [] };
  }

  // Read header row — capture both raw and normalised keys
  const headerRow = sheet.getRow(1);
  const rawHeaders: string[] = [];
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    const raw = cellToString(cell);
    rawHeaders.push(raw);
    headers.push(normaliseKey(raw));
  });

  if (headers.length === 0) {
    return { rows: [], fileError: "File must have a header row and at least one data row.", birthYearWarningCount: 0, originalHeaders: [] };
  }

  const dataRowCount = (sheet.rowCount ?? 0) - 1;
  if (dataRowCount > VOTER_LIST_ROW_CAP) {
    return {
      rows: [],
      fileError: `File has ${dataRowCount.toLocaleString()} rows — the maximum is ${VOTER_LIST_ROW_CAP.toLocaleString()}. Split your file into smaller batches and upload each separately.`,
      birthYearWarningCount: 0,
      originalHeaders: [],
    };
  }

  const rows: ReviewRow[] = [];
  let id = 0;
  let birthYearWarningCount = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const cell = row.getCell(idx + 1);
      raw[h] = cellToString(cell).trim();
    });

    // Skip entirely empty rows
    if (Object.values(raw).every((v) => v === "")) return;

    const rawValues: Record<string, string> = {};
    rawHeaders.forEach((h, idx) => {
      const cell = row.getCell(idx + 1);
      rawValues[h] = cellToString(cell).trim();
    });

    const { row: reviewRow, bumpedBirthYearWarning } = buildReviewRow(raw, rowNumber, id++, customFields);
    reviewRow.rawValues = rawValues;
    if (bumpedBirthYearWarning) birthYearWarningCount++;
    rows.push(reviewRow);
  });

  if (rows.length === 0) {
    return { rows: [], fileError: "No data rows found after the header.", birthYearWarningCount: 0, originalHeaders: [] };
  }

  return { rows, fileError: null, birthYearWarningCount, originalHeaders: rawHeaders };
}
