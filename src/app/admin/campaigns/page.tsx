import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

async function getAllCampaigns() {
  return db.campaign.findMany({
    include: {
      _count: { select: { memberships: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

type Campaign = Awaited<ReturnType<typeof getAllCampaigns>>[number];

function statusBadge(c: Campaign) {
  if (c.deletedAt) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
        Deleted
      </span>
    );
  }
  if (!c.isActive) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
        Inactive
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
      Active
    </span>
  );
}

export default async function AdminCampaignsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user.platformRole) redirect("/dashboard");

  const campaigns = await getAllCampaigns();

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">All Campaigns</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every campaign in the platform — including inactive and soft-deleted.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {campaigns.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No campaigns found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Campaign
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                  Municipality
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                  Created
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                  Members
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {campaigns.map((c) => {
                const isDeleted = !!c.deletedAt;
                return (
                  <tr
                    key={c.id}
                    className={[
                      "hover:bg-slate-50 transition-colors",
                      isDeleted ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      {c.description && (
                        <p className="text-xs text-slate-400 truncate max-w-xs mt-0.5">
                          {c.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell text-slate-600">
                      {c.municipality ?? c.city}
                      {c.province && (
                        <span className="text-slate-400">, {c.province}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell text-slate-500 tabular-nums">
                      {new Date(c.createdAt).toLocaleDateString("en-CA", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell text-slate-600 tabular-nums">
                      {c._count.memberships}
                    </td>
                    <td className="px-5 py-4">{statusBadge(c)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/campaigns/${c.id}`}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} total
      </p>
    </div>
  );
}
