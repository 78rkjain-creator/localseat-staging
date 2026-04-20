import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { PLATFORM_ROLE_LABELS } from "@/types";
import type { PlatformRole } from "@/types";
import { ChangePasswordForm } from "./change-password-form";

export default async function AdminAccountPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { platformRole, firstName, lastName, email } = session.user;
  if (platformRole !== "super_user" && platformRole !== "super_admin") {
    redirect("/admin");
  }

  const roleLabel = PLATFORM_ROLE_LABELS[platformRole as PlatformRole] ?? platformRole;

  return (
    <div className="px-6 py-8 max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My Account</h1>
        <p className="text-slate-500 mt-1">{roleLabel}</p>
      </div>

      {/* Profile summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Profile</h2>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-24 flex-shrink-0">Name</span>
            <span className="text-sm text-slate-800">{firstName} {lastName}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-24 flex-shrink-0">Email</span>
            <span className="text-sm text-slate-800">{email}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-24 flex-shrink-0">Role</span>
            <span className="text-sm text-slate-800">{roleLabel}</span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Change Password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
