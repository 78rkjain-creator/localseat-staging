import ExcelJS from "exceljs";

export const SPLIT_BATCH_SIZE = 9_000;

export interface FileBatchItem {
  csvText: string;
  rowCount: number;
}

function escapeCsvField(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n") || v.includes("\r")) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

function cellToString(cell: ExcelJS.Cell): string {
  const { value } = cell;
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "object") {
    if ("richText" in value) {
      return (value as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    }
    if ("result" in value) {
      const r = (value as ExcelJS.CellFormulaValue).result;
      if (r instanceof Date && !isNaN(r.getTime())) {
        const y = r.getFullYear();
        const m = String(r.getMonth() + 1).padStart(2, "0");
        const d = String(r.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
      return r !== null && r !== undefined ? String(r) : "";
    }
    if ("text" in value) return String((value as ExcelJS.CellHyperlinkValue).text);
    return String(value);
  }
  return String(value);
}

export function splitCsvText(
  text: string,
  batchSize = SPLIT_BATCH_SIZE,
): { batches: FileBatchItem[]; totalRows: number } {
  const normalised = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalised.split("\n");
  const header = lines[0] ?? "";
  const dataLines = lines.slice(1).filter((l) => l.trim());
  const batches: FileBatchItem[] = [];
  for (let i = 0; i < dataLines.length; i += batchSize) {
    const chunk = dataLines.slice(i, i + batchSize);
    batches.push({ csvText: [header, ...chunk].join("\n"), rowCount: chunk.length });
  }
  return { batches, totalRows: dataLines.length };
}

export async function splitXlsxFile(
  file: File,
  batchSize = SPLIT_BATCH_SIZE,
): Promise<{ batches: FileBatchItem[]; totalRows: number; fileError: string | null }> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return { batches: [], totalRows: 0, fileError: "Could not read the XLSX file." };
  }

  let sheet: ExcelJS.Worksheet | undefined;
  workbook.eachSheet((ws) => {
    if (!sheet && ws.state !== "veryHidden" && ws.name !== "_Lists") sheet = ws;
  });
  if (!sheet) {
    return { batches: [], totalRows: 0, fileError: "No readable worksheet found." };
  }

  const allRows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(cellToString(cell));
    });
    allRows.push(cells);
  });

  if (allRows.length < 2) {
    return { batches: [], totalRows: 0, fileError: "No data rows found after the header." };
  }

  const headerCsv = allRows[0].map(escapeCsvField).join(",");
  const dataRows = allRows.slice(1);
  const batches: FileBatchItem[] = [];
  for (let i = 0; i < dataRows.length; i += batchSize) {
    const chunk = dataRows.slice(i, i + batchSize);
    batches.push({
      csvText: [headerCsv, ...chunk.map((r) => r.map(escapeCsvField).join(","))].join("\n"),
      rowCount: chunk.length,
    });
  }

  return { batches, totalRows: dataRows.length, fileError: null };
}
