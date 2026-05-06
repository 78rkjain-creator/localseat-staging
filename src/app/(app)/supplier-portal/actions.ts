"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseCsvToReviewRows } from "@/lib/csv-import";
import { parseXlsxToReviewRows } from "@/lib/xlsx-import";
import { Prisma } from "@prisma/client";
import type { VoterCsvRow } from "@/app/(app)/import/voters/actions";

async function requireDataSupplier() {
  const session = await getServerSession(authOptions);
  if (!session) return { error: "Not authenticated." } as const;
  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) return { error: "No active campaign." } as const;
  if (activeRole !== "data_supplier") {
    return { error: "Supplier portal access only." } as const;
  }
  return { session, campaignId: activeCampaignId } as const;
}

export interface UploadResult {
  error?: string;
  importId?: string;
  recordCount?: number;
  validCount?: number;
  errorCount?: number;
  errors?: Array<{ rowNum: number; firstName: string; lastName: string; missingFields: string[] }>;
}

export async function submitDataUpload(formData: FormData): Promise<UploadResult> {
  const auth = await requireDataSupplier();
  if ("error" in auth) return auth;
  const { campaignId, session } = auth;

  const file = formData.get("file") as File | null;
  const supplierNote = (formData.get("supplierNote") as string | null)?.trim() || null;

  if (!file || file.size === 0) return { error: "No file uploaded." };

  const fileName = file.name;
  const isXlsx = fileName.toLowerCase().endsWith(".xlsx");
  const isCsv = fileName.toLowerCase().endsWith(".csv");

  if (!isXlsx && !isCsv) {
    return { error: "Only .csv and .xlsx files are supported." };
  }

  let parseResult: Awaited<ReturnType<typeof parseCsvToReviewRows>>;

  if (isXlsx) {
    parseResult = await parseXlsxToReviewRows(file);
  } else {
    const text = await file.text();
    parseResult = parseCsvToReviewRows(text);
  }

  if (parseResult.fileError) {
    return { error: parseResult.fileError };
  }

  const { rows } = parseResult;

  // Build valid rows (VoterCsvRow[]) and error list
  const validRows: VoterCsvRow[] = [];
  const errorRows: Array<{ rowNum: number; firstName: string; lastName: string; missingFields: string[] }> = [];

  for (const row of rows) {
    if (row.missingOnParse.length > 0) {
      errorRows.push({
        rowNum: row.originalRowNum,
        firstName: row.fields.firstName,
        lastName: row.fields.lastName,
        missingFields: row.missingOnParse as string[],
      });
    } else {
      validRows.push({
        ...row.fields,
        customFieldValues: row.customFieldValues,
      });
    }
  }

  const recordCount = rows.length;
  const validCount = validRows.length;
  const errorCount = errorRows.length;

  const dataImport = await db.dataImport.create({
    data: {
      campaignId,
      uploadedById: session.user.id,
      fileName,
      recordCount,
      validCount,
      errorCount,
      status: "pending",
      rawData: validRows as object[],
      errors: errorRows.length > 0 ? (errorRows as object[]) : Prisma.JsonNull,
      supplierNote,
    },
  });

  revalidatePath("/supplier-portal");
  return { importId: dataImport.id, recordCount, validCount, errorCount, errors: errorRows };
}
