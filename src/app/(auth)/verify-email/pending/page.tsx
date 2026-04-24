import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

export default async function VerifyEmailPendingPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">

      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-orange-500 flex items-center justify-center shadow-md">
          <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">LocalSeat</h1>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-slate-100 p-8">

        {/* Envelope icon */}
        <div className="flex justify-center mb-5">
          <div className="h-14 w-14 rounded-2xl bg-orange-50 flex items-center justify-center">
            <svg className="h-7 w-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-slate-900 text-center mb-3">
          Check your inbox
        </h2>

        <p className="text-sm text-slate-500 text-center mb-5 leading-relaxed">
          We sent a verification link to{" "}
          {email
            ? <span className="font-medium text-slate-800">{email}</span>
            : "your email address"
          }
          . Click the link to activate your account and get started.
        </p>

        {/* Spam warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">Can&apos;t find the email?</span>{" "}
            Check your spam or junk folder — it may have been filtered automatically.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/resend-verification"
            className="block w-full text-center h-10 leading-[40px] rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            Resend verification email
          </Link>
          <SignOutButton />
        </div>

      </div>

      <p className="mt-8 text-xs text-slate-400">LocalSeat &mdash; Built for Canadian municipal campaigns</p>
    </div>
  );
}
