import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSuperUser } from "@/lib/permissions";
import { ROLE_LABELS } from "@/types";
import type { Role } from "@/types";
import Link from "next/link";
import {
  deactivateCampaign,
  reactivateCampaign,
  deleteCampaign,
  restoreCampaign,
} from "./actions";

async function getCampaignDetail(campaignId: string) {
  const [campaign, voterCount, responseCount, donorCount, listCount] =
    await Promise.all([
      db.campaign.findUnique({
        where: { id: campaignId },
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      db.person.count({ where: { campaignId } }),
      db.canvassResponse.count({
        where: { assignment: { canvassList: { campaignId } } },
      }),
      db.donor.count({ where: { campaignId } }),
      db.canvassList.count({ where: { campaignId } }),
    ]);

  return { campaign, voterCount, responseCount, donorCount, listCount };
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-36 flex-shrink-0">
        {label}
      </span>
      <span className="text-sm text-slate-800">{value ?? <span className="text-slate-300">—</span>}</span>
    </div>
  );
}

function StatusBadge({ isActive, deletedAt }: { isActive: boolean; deletedAt: Date | null }) {
  if (deletedAt) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
        Deleted
      </span>
    );
  }
  if (!isActive) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
        Inactive
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
      Active
    </span>
  );
}

export default async function AdminCampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user.platformRole) redirect("/dashboard");

  const { campaign, voterCount, responseCount, donorCount, listCount } =
    await getCampaignDetail(campaignId);

  if (!campaign) notFound();

  const callerIsSuperUser = isSuperUser(session.user.platformRole);

  const deactivateAction = deactivateCampaign.bind(null, campaignId);
  const reactivateAction = reactivateCampaign.bind(null, campaignId);
  const deleteAction = deleteCampaign.bind(null, campaignId);
  const restoreAction = restoreCampaign.bind(null, campaignId);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      {/* Back */}
      <Link
        href="/admin/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All Campaigns
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3 mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-slate-900">{campaign.name}</h1>
          {campaign.description && (
            <p className="mt-1 text-sm text-slate-500">{campaign.description}</p>
          )}
        </div>
        <StatusBadge isActive={campaign.isActive} deletedAt={campaign.deletedAt} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Campaign details */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Campaign Details</h2>
            <div className="flex flex-col gap-3">
              <DetailRow label="Municipality" value={campaign.municipality ?? campaign.city} />
              <DetailRow label="Province" value={campaign.province} />
              <DetailRow
                label="Wards"
                value={campaign.wards.length > 0 ? campaign.wards.join(", ") : null}
              />
              <DetailRow label="Office Sought" value={campaign.officeSought} />
              <DetailRow label="Ballot Name" value={campaign.ballotName} />
              <DetailRow label="Election Year" value={campaign.year} />
              <DetailRow
                label="Election Date"
                value={
                  campaign.electionDate
                    ? new Date(campaign.electionDate).toLocaleDateString("en-CA", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : null
                }
              />
              <DetailRow
                label="Created"
                value={new Date(campaign.createdAt).toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              />
              {campaign.deletedAt && (
                <DetailRow
                  label="Deleted"
                  value={new Date(campaign.deletedAt).toLocaleDateString("en-CA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
              )}
            </div>
          </div>

          {/* Members */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">
                Members ({campaign.memberships.length})
              </h2>
            </div>
            {campaign.memberships.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">No members.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Role</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {campaign.memberships.map((m) => (
                    <tr key={m.id} className={m.deletedAt ? "opacity-40" : ""}>
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {m.user.firstName} {m.user.lastName}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell text-slate-500 truncate max-w-[200px]">
                        {m.user.email}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {ROLE_LABELS[m.role as Role] ?? m.role}
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell text-slate-400 tabular-nums">
                        {new Date(m.createdAt).toLocaleDateString("en-CA", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Stats */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Campaign Stats</h2>
            <div className="flex flex-col gap-3">
              {[
                { label: "Voter records", value: voterCount },
                { label: "Canvass responses", value: responseCount },
                { label: "Donor records", value: donorCount },
                { label: "Walk lists", value: listCount },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{s.label}</span>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">
                    {s.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Actions</h2>
            <div className="flex flex-col gap-3">
              {/* Activate / Deactivate */}
              {!campaign.deletedAt && (
                campaign.isActive ? (
                  <form action={deactivateAction}>
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors text-left"
                    >
                      Deactivate campaign
                    </button>
                  </form>
                ) : (
                  <form action={reactivateAction}>
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-left"
                    >
                      Reactivate campaign
                    </button>
                  </form>
                )
              )}

              {/* Delete / Restore */}
              {!campaign.deletedAt ? (
                <form action={deleteAction}>
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-left"
                  >
                    Soft delete campaign
                  </button>
                </form>
              ) : callerIsSuperUser ? (
                <form action={restoreAction}>
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-left"
                  >
                    Restore campaign
                  </button>
                </form>
              ) : (
                <p className="text-xs text-slate-400">
                  This campaign has been deleted. Only a Super User can restore it.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
