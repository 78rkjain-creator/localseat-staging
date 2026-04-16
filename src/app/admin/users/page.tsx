import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLATFORM_ROLE_LABELS } from "@/types";
import type { PlatformRole } from "@/types";
import Link from "next/link";

async function getAllUsers() {
  return db.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isActive: true,
      platformRole: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

type User = Awaited<ReturnType<typeof getAllUsers>>[number];

function PlatformRoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  const label = PLATFORM_ROLE_LABELS[role as PlatformRole] ?? role;
  const isSuperUser = role === "super_user";
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
        isSuperUser
          ? "bg-brand-50 text-brand-700"
          : "bg-slate-100 text-slate-600",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        isActive
          ? "bg-green-50 text-green-700"
          : "bg-amber-50 text-amber-700",
      ].join(" ")}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user.platformRole) redirect("/dashboard");

  const users = await getAllUsers();

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">All Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every user account in the platform — including inactive accounts.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {users.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No users found.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                  Email
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                  Platform Role
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                  Campaigns
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                  Joined
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((u: User) => (
                <tr
                  key={u.id}
                  className={[
                    "hover:bg-slate-50 transition-colors",
                    !u.isActive ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-xs text-slate-400 md:hidden mt-0.5 truncate">
                      {u.email}
                    </p>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-slate-600 truncate max-w-[200px]">
                    {u.email}
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    {u.platformRole ? (
                      <PlatformRoleBadge role={u.platformRole} />
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <ActiveBadge isActive={u.isActive} />
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell text-slate-600 tabular-nums">
                    {u._count.memberships}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell text-slate-500 tabular-nums">
                    {new Date(u.createdAt).toLocaleDateString("en-CA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        {users.length} user{users.length !== 1 ? "s" : ""} total
      </p>
    </div>
  );
}
