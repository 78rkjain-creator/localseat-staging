import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { canReviewDataImports } from "@/lib/permissions";
import { BackLink } from "@/components/ui/back-link";
import { ImportActions } from "./import-actions";
import type { Role } from "@/types";
import type { VoterCsvRow } from "@/app/(app)/import/voters/actions";

export const metadata: Metadata = { title: "Review Import" };

const PREVIEW_COLUMNS: (keyof VoterCsvRow)[] = [
  "firstName", "lastName", "streetNumber", "streetName", "unitNumber",
  "city", "province", "postalCode", "phoneHome", "phoneMobile", "email",
];

const COLUMN_LABELS: Partial<Record<keyof VoterCsvRow, string>> = {
  firstName: "First Name",
  lastName: "Last Name",
  streetNumber: "St #",
  streetName: "Street Name",
  unitNumber: "Unit",
  city: "City",
  province: "Prov",
  postalCode: "Postal Code",
  phoneHome: "Phone (Home)",
  phoneMobile: "Phone (Mobile)",
  email: "Email",
};

function fmt(date: Date): string {
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ importId: string }>;
}) {
  const { importId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canReviewDataImports(activeRole as Role)) redirect("/dashboard");

  const dataImport = await db.dataImport.findFirst({
    where: { id: importId, campaignId: activeCampaignId },
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!dataImport) notFound();

  const membership = await db.campaignMembership.findFirst({
    where: { campaignId: activeCampaignId, userId: dataImport.uploadedById },
    select: { company: true },
  });

  const rawRows = (dataImport.rawData as unknown as VoterCsvRow[]) ?? [];
  const previewRows = rawRows.slice(0, 25);

  type ErrorRow = { rowNum: number; firstName: string; lastName: string; missingFields: string[] };
  const errorRows = (dataImport.errors as ErrorRow[] | null) ?? [];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-2">
        <BackLink fallbackHref="/campaign-settings/imports" label="Data imports" />
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">{dataImport.fileName}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {membership?.company
            ? `${membership.company} · `
            : ""}
          {dataImport.uploadedBy.firstName} {dataImport.uploadedBy.lastName}
          {" · "}Uploaded {fmt(dataImport.createdAt)}
        </p>
        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
          <span>{dataImport.recordCount.toLocaleString()} records</span>
          <span className="text-emerald-600">{dataImport.validCount.toLocaleString()} valid</span>
          {dataImport.errorCount > 0 && (
            <span className="text-amber-600">{dataImport.errorCount.toLocaleString()} errors</span>
          )}
        </div>
      </div>

      {dataImport.supplierNote && (
        <div className="bg-slate-50 rounded-xl px-4 py-3 mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Supplier note</p>
          <p className="text-sm text-slate-700">{dataImport.supplierNote}</p>
        </div>
      )}

      {/* Preview table */}
      {previewRows.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Preview{" "}
            <span className="text-slate-400 font-normal">
              (first {previewRows.length} of {dataImport.validCount.toLocaleString()} valid records)
            </span>
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {PREVIEW_COLUMNS.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {COLUMN_LABELS[col] ?? col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {previewRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {PREVIEW_COLUMNS.map((col) => (
                        <td key={col} className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap max-w-[160px] truncate">
                          {(row as unknown as Record<string, string>)[col] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Validation errors */}
      {errorRows.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Validation errors ({errorRows.length.toLocaleString()})
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="max-h-64 overflow-y-auto p-3">
              {errorRows.map((err, i) => (
                <div key={i} className="py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-xs text-slate-400 mr-2">Row {err.rowNum}</span>
                  <span className="text-xs text-slate-700">
                    {err.firstName} {err.lastName} —{" "}
                  </span>
                  <span className="text-xs text-red-600">
                    Missing: {err.missingFields.join(", ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {dataImport.status === "pending" ? (
        <ImportActions
          importId={importId}
          validCount={dataImport.validCount}
        />
      ) : (
        <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-500">
          This import has already been processed (status: <strong>{dataImport.status}</strong>).
          {dataImport.reviewNote && (
            <p className="mt-1 text-red-600 italic">{dataImport.reviewNote}</p>
          )}
        </div>
      )}
    </div>
  );
}
