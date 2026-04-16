import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSuperUser } from "@/lib/permissions";
import { ROLE_LABELS, PLATFORM_ROLE_LABELS } from "@/types";
import type { Role, PlatformRole } from "@/types";
import Link from "next/link";
import { ResetPasswordButton } from "./reset-password-button";
import {
  deactivateUser,
  reactivateUser,
  assignSuperAdmin,
  revokePlatformRole,
} from "./actions";

async function getUserDetail(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneHome: true,
      phoneMobile: true,
      isActive: true,
      platformRole: true,
      createdAt: true,
      memberships: {
        include: {
          campaign: { select: { id: true, name: true, municipality: true, city: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-32 flex-shrink-0">
        {label}
      </span>
      <span className="text-sm text-slate-800">{value ?? <span className="text-slate-300">—</span>}</span>
    </div>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user.platformRole) redirect("/dashboard");

  const user = await getUserDetail(userId);
  if (!user) notFound();

  const callerIsSuperUser = isSuperUser(session.user.platformRole);
  const isOwnAccount = session.user.id === userId;

  const deactivateAction = deactivateUser.bind(null, userId);
  const reactivateAction = reactivateUser.bind(null, userId);
  const assignSuperAdminAction = assignSuperAdmin.bind(null, userId);
  const revokeAction = revokePlatformRole.bind(null, userId);

  const platformRoleLabel = user.platformRole
    ? (PLATFORM_ROLE_LABELS[user.platformRole as PlatformRole] ?? user.platformRole)
    : null;

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All Users
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-slate-600">
            {user.firstName[0]}{user.lastName[0]}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-slate-900">
              {user.firstName} {user.lastName}
            </h1>
            {user.platformRole && (
              <span className={[
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
                user.platformRole === "super_user"
                  ? "bg-brand-50 text-brand-700"
                  : "bg-slate-100 text-slate-600",
              ].join(" ")}>
                {platformRoleLabel}
              </span>
            )}
            <span className={[
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
              user.isActive ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700",
            ].join(" ")}>
              {user.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* User details */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Account Details</h2>
            <div className="flex flex-col gap-3">
              <DetailRow label="Email" value={user.email} />
              <DetailRow label="Phone (home)" value={user.phoneHome} />
              <DetailRow label="Phone (mobile)" value={user.phoneMobile} />
              <DetailRow label="Platform Role" value={platformRoleLabel} />
              <DetailRow label="Status" value={user.isActive ? "Active" : "Inactive"} />
              <DetailRow
                label="Joined"
                value={new Date(user.createdAt).toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              />
            </div>
          </div>

          {/* Campaign memberships */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">
                Campaign Memberships ({user.memberships.length})
              </h2>
            </div>
            {user.memberships.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">
                No campaign memberships.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Campaign</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Role</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {user.memberships.map((m) => (
                    <tr key={m.id} className={m.deletedAt ? "opacity-40" : ""}>
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/campaigns/${m.campaign.id}`}
                          className="font-medium text-slate-900 hover:text-brand-600 transition-colors"
                        >
                          {m.campaign.name}
                        </Link>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {m.campaign.municipality ?? m.campaign.city}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {ROLE_LABELS[m.role as Role] ?? m.role}
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell text-slate-400 tabular-nums">
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

        {/* Right — actions */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Actions</h2>
            <div className="flex flex-col gap-3">
              {/* Activate / Deactivate */}
              {user.isActive ? (
                <form action={deactivateAction}>
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors text-left"
                  >
                    Deactivate user
                  </button>
                </form>
              ) : (
                <form action={reactivateAction}>
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-left"
                  >
                    Reactivate user
                  </button>
                </form>
              )}

              {/* Platform role management — super_user only */}
              {callerIsSuperUser && (
                <>
                  <div className="border-t border-slate-100 pt-3 mt-1">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                      Platform Role
                    </p>

                    {/* Assign super_admin — only if user has no platform role */}
                    {!user.platformRole && (
                      <form action={assignSuperAdminAction}>
                        <button
                          type="submit"
                          className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-left"
                        >
                          Assign Super Admin
                        </button>
                      </form>
                    )}

                    {/* Revoke — only if they have a role and it's not our own account */}
                    {user.platformRole && !isOwnAccount && (
                      <form action={revokeAction}>
                        <button
                          type="submit"
                          className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-left"
                        >
                          Revoke platform role
                        </button>
                      </form>
                    )}

                    {user.platformRole && isOwnAccount && (
                      <p className="text-xs text-slate-400">
                        You cannot revoke your own platform role.
                      </p>
                    )}
                  </div>

                  {/* Reset password */}
                  <div className="border-t border-slate-100 pt-3 mt-1">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                      Password
                    </p>
                    <ResetPasswordButton userId={userId} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
