import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UploadSection } from "./upload-section";

export const metadata: Metadata = { title: "Data Upload Portal" };

const STATUS_PILLS: Record<string, string> = {
  pending:    "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  completed:  "bg-emerald-50 text-emerald-700",
  approved:   "bg-emerald-50 text-emerald-700",
  rejected:   "bg-red-50 text-red-700",
  failed:     "bg-red-50 text-red-700",
};

function fmt(date: Date): string {
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export default async function SupplierPortalPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (activeRole !== "data_supplier") redirect("/dashboard");

  const campaignId = activeCampaignId;
  const userId = session.user.id;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true },
  });

  const imports = await db.dataImport.findMany({
    where: { campaignId, uploadedById: userId },
    orderBy: { createdAt: "desc" },
  });

  const totalUploads = imports.length;
  const totalRecords = imports.reduce((sum, i) => sum + i.recordCount, 0);
  const lastUpload = imports[0]?.createdAt ?? null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Data upload portal</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload voter and resident data for{" "}
          <strong className="text-slate-700">{campaign?.name ?? "your campaign"}</strong>
        </p>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-6 mb-6 text-sm text-slate-500">
        <span>
          <strong className="text-slate-900">{totalUploads}</strong>{" "}
          {totalUploads === 1 ? "upload" : "uploads"}
        </span>
        <span>
          <strong className="text-slate-900">{totalRecords.toLocaleString()}</strong>{" "}
          records uploaded
        </span>
        <span>
          Last upload:{" "}
          <strong className="text-slate-900">{lastUpload ? fmt(lastUpload) : "—"}</strong>
        </span>
      </div>

      {/* Upload section */}
      <div className="mb-8">
        <UploadSection />
      </div>

      {/* Upload history */}
      {imports.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-3">Upload history</h2>
          <div className="flex flex-col gap-2">
            {imports.map((imp) => {
              const pillClass = STATUS_PILLS[imp.status] ?? "bg-slate-100 text-slate-500";
              return (
                <div
                  key={imp.id}
                  className="bg-white rounded-xl border border-slate-100 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-900 truncate">{imp.fileName}</p>
                        <span
                          className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${pillClass}`}
                        >
                          {imp.status.charAt(0).toUpperCase() + imp.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fmt(imp.createdAt)} · {imp.recordCount.toLocaleString()} records
                      </p>
                      {imp.reviewNote && imp.status === "rejected" && (
                        <p className="text-xs text-red-600 italic mt-1">{imp.reviewNote}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
