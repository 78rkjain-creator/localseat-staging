import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewSigns, canManageSigns } from "@/lib/permissions";
import { db } from "@/lib/db";
import { AddSignButton } from "./add-sign-button";
import { SignStatusToggle } from "./sign-status-toggle";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Signs" };

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

type SignStatusFilter = "all" | "to_be_installed" | "installed";

export default async function SignsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { activeCampaignId, activeRole } = session.user;
  if (!activeCampaignId) redirect("/select-campaign");
  if (!activeRole || !canViewSigns(activeRole as Role)) redirect("/dashboard");

  const params = await searchParams;
  const statusFilter = (params.status as SignStatusFilter) || "all";
  const canManage = canManageSigns(activeRole as Role);

  const whereStatus =
    statusFilter === "to_be_installed" ? { status: "to_be_installed" as const } :
    statusFilter === "installed"       ? { status: "installed" as const } :
    {};

  const [signs, total] = await Promise.all([
    db.sign.findMany({
      where: { campaignId: activeCampaignId, deletedAt: null, ...whereStatus },
      include: {
        address: { select: { streetNumber: true, streetName: true, city: true } },
        addedBy: { select: { firstName: true, lastName: true } },
        installedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.sign.count({ where: { campaignId: activeCampaignId, deletedAt: null } }),
  ]);

  const filters: { value: SignStatusFilter; label: string }[] = [
    { value: "all",              label: "All" },
    { value: "to_be_installed",  label: "To be installed" },
    { value: "installed",        label: "Installed" },
  ];

  const filterLinkCls = (active: boolean) =>
    [
      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
      active
        ? "bg-slate-900 text-white"
        : "text-slate-600 hover:bg-slate-100",
    ].join(" ");

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Signs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} total
            {statusFilter !== "all" && ` · ${signs.length} ${statusFilter === "to_be_installed" ? "to be installed" : "installed"}`}
          </p>
        </div>
        {canManage && <AddSignButton />}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-6 bg-slate-50 border border-slate-100 rounded-xl p-1 w-fit">
        {filters.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/signs" : `/signs?status=${f.value}`}
            className={filterLinkCls(statusFilter === f.value)}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Sign list */}
      {signs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700 mb-1">No signs yet</p>
          <p className="text-xs text-slate-400">
            {statusFilter !== "all"
              ? "No signs match the current filter."
              : canManage
              ? "Add the first sign to start tracking placements."
              : "Signs will appear here once they are added."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {signs.map((sign) => {
            const location =
              sign.locationType === "residential" && sign.address
                ? `${sign.address.streetNumber} ${sign.address.streetName}, ${sign.address.city}`
                : sign.locationText ?? "Unknown location";

            const addedByName = `${sign.addedBy.firstName} ${sign.addedBy.lastName}`;
            const installedByName = sign.installedBy
              ? `${sign.installedBy.firstName} ${sign.installedBy.lastName}`
              : null;

            return (
              <div
                key={sign.id}
                className="bg-white rounded-2xl border border-slate-100 px-5 py-3.5 flex items-center gap-4"
              >
                {/* Location info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{location}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {sign.locationType === "non_residential" ? "Non-residential · " : ""}
                    Added by {addedByName}
                    {installedByName && ` · Installed by ${installedByName}`}
                    {" · "}{new Date(sign.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                  </p>
                  {sign.notes && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{sign.notes}</p>
                  )}
                </div>

                {/* Status badge / toggle */}
                {canManage ? (
                  <SignStatusToggle
                    signId={sign.id}
                    currentStatus={sign.status as "to_be_installed" | "installed"}
                  />
                ) : (
                  <span className={[
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0",
                    sign.status === "installed"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200",
                  ].join(" ")}>
                    {sign.status === "installed" ? "Installed" : "To be installed"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
