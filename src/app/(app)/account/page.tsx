import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ROLE_LABELS } from "@/types";
import type { Role } from "@/types";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { firstName, lastName, email, activeCampaignId, activeRole, memberships } = session.user;

  const activeMembership = memberships.find((m) => m.campaignId === activeCampaignId);
  const campaignName = activeMembership?.campaignName ?? null;
  const roleLabel = activeRole ? (ROLE_LABELS[activeRole as Role] ?? activeRole) : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Account</h1>

      {/* Identity card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm px-6 py-6 mb-4">
        <div className="flex items-center gap-4 mb-5">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-slate-500">
              {firstName?.[0] ?? "?"}{lastName?.[0] ?? ""}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-900 leading-tight">
              {firstName} {lastName}
            </p>
            <p className="text-sm text-slate-500 truncate">{email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
          {campaignName && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">Campaign</span>
              <span className="text-sm font-medium text-slate-900 text-right truncate max-w-[60%]">
                {campaignName}
              </span>
            </div>
          )}
          {roleLabel && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">Role</span>
              <span className="text-sm font-medium text-slate-900">{roleLabel}</span>
            </div>
          )}
          {memberships.length > 1 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">Campaigns</span>
              <span className="text-sm font-medium text-slate-900">{memberships.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation links */}
      <div className="flex flex-col gap-2 mb-4">
        <Link
          href="/account/profile"
          className="flex items-center justify-between px-5 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm font-medium text-slate-800">Edit profile</span>
          </div>
          <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {memberships.length > 1 && (
          <Link
            href="/account/campaigns"
            className="flex items-center justify-between px-5 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V7a2 2 0 012-2h4l2-2h4l2 2h4a2 2 0 012 2v14M3 21h18M9 21V11h6v10" />
              </svg>
              <span className="text-sm font-medium text-slate-800">Switch campaign</span>
            </div>
            <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      {/* Sign out */}
      <SignOutButton />
    </div>
  );
}
