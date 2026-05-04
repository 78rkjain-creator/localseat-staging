import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UsersClient } from "./users-client";

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
      memberships: {
        where: { deletedAt: null },
        select: {
          role: true,
          campaign: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user.platformRole) redirect("/dashboard");

  const users = await getAllUsers();

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">All Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every user account in the platform — including inactive accounts.
        </p>
      </div>

      <UsersClient users={users} />
    </div>
  );
}
