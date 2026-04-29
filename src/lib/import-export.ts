import { listMissingFields, normaliseKey, classifyRow } from "./csv-import";
import type { ReviewRow, ReviewBucket } from "./csv-import";

function mapFieldByHeader(row: ReviewRow, header: string): string {
  const norm = normaliseKey(header);
  const f = row.fields;
  const map: Record<string, string> = {
    firstname:      f.firstName,
    lastname:       f.lastName,
    streetnumber:   f.streetNumber,
    streetname:     f.streetName,
    unitnumber:     f.unitNumber,
    city:           f.city,
    province:       f.province,
    postalcode:     f.postalCode,
    phonehome:      f.phoneHome,
    phonemobile:    f.phoneMobile,
    email:          f.email,
    birthdate:      f.birthDate,
    pollnumber:     f.pollNumber,
    voterid:        f.voterId,
    supportlevel:   f.supportLevel,
    tags:           f.tags,
    gender:         f.gender,
    notes:          f.notes,
    confirmedvoter: f.isConfirmedVoter,
  };
  return map[norm] ?? "";
}

function escape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function buildVoterExportCsv(
  rows: ReviewRow[],
  originalHeaders: string[],
  buckets: Set<ReviewBucket>,
  includeAnnotation = true,
): string {
  const selectedRows = rows.filter((r) => buckets.has(classifyRow(r)));
  const headers = [...originalHeaders];
  if (includeAnnotation) headers.push("Missing fields");

  const lines: string[] = [headers.map(escape).join(",")];
  for (const row of selectedRows) {
    const values = originalHeaders.map((h) => row.rawValues?.[h] ?? mapFieldByHeader(row, h));
    if (includeAnnotation) {
      values.push(listMissingFields(row).join("; "));
    }
    lines.push(values.map((v) => escape(v ?? "")).join(","));
  }

  return "﻿" + lines.join("\n"); // UTF-8 BOM for Excel
}

export function triggerCsvDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
