import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isExpired } from "@/lib/verification";
import { SignOutButton } from "../verify-email/pending/sign-out-button";

export default async function AccountExpiredPage() {
  const session = await getServerSession(authOptions);

  // Soft-delete accounts that have genuinely expired — idempotent
  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailVerified: true,
        verificationTokenExpiry: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (user && !user.deletedAt && isExpired(user)) {
      await db.user.update({
        where: { id: session.user.id },
        data: { isActive: false, deletedAt: new Date() },
      });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand-500 flex items-center justify-center shadow-soft">
          <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">LocalSeat</h1>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-card border border-slate-100 p-8">
        <div className="flex justify-center mb-5">
          <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-slate-900 text-center mb-2">Account expired</h2>
        <p className="text-sm text-slate-500 text-center mb-4">
          Your account was not verified within 14 days and has been deactivated.
        </p>

        <div className="bg-slate-50 rounded-2xl border border-slate-100 px-4 py-4 mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">What to do next</p>
          <ul className="flex flex-col gap-1.5">
            <li className="flex items-start gap-2 text-sm text-slate-600">
              <span className="text-slate-400 mt-0.5 flex-shrink-0">•</span>
              <span>
                <strong>Candidate registering a new campaign?</strong>{" "}
                Create a new account below.
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-slate-600">
              <span className="text-slate-400 mt-0.5 flex-shrink-0">•</span>
              <span>
                <strong>Team member added by a manager?</strong>{" "}
                Ask your campaign manager to re-add you with verification skipped.
              </span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/register"
            className="block w-full text-center h-11 leading-[44px] rounded-2xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
          >
            Register as a candidate
          </Link>
          <SignOutButton />
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-400">LocalSeat &mdash; Built for Canadian municipal campaigns</p>
    </div>
  );
}
