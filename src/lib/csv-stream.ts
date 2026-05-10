/**
 * Streams CSV rows to the client using a ReadableStream.
 * Avoids loading the entire dataset into memory at once.
 */

const encoder = new TextEncoder();

/** Escape a CSV field value. */
export function csvEscape(val: string | number | boolean | null | undefined): string {
  if (val == null) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Join fields into a CSV row string. */
export function csvRow(fields: (string | number | boolean | null | undefined)[]): string {
  return fields.map(csvEscape).join(",");
}

/**
 * Create a streaming CSV Response.
 *
 * @param filename - The download filename.
 * @param headers - Array of header column names.
 * @param writeRows - Async generator or callback that pushes CSV row strings
 *   to the controller. Called once; should yield/enqueue all data rows.
 */
export function streamingCsvResponse(
  filename: string,
  headers: string[],
  writeRows: (enqueue: (row: string) => void) => Promise<void>
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      // Write BOM for Excel compatibility, then header row
      controller.enqueue(encoder.encode("\uFEFF" + csvRow(headers) + "\r\n"));

      await writeRows((row: string) => {
        controller.enqueue(encoder.encode(row + "\r\n"));
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Transfer-Encoding": "chunked",
    },
  });
}
