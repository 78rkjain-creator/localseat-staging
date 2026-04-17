"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { resendVerificationEmail } from "./actions";

type Status = "idle" | "loading" | "sent" | "expired" | "error";

export default function ResendVerificationPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const result = await resendVerificationEmail(email);

    if ("error" in result) {
      setStatus(result.error === "expired" ? "expired" : "error");
    } else {
      setStatus("sent");
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
        {status === "sent" ? (
          <>
            <div className="flex justify-center mb-5">
              <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 text-center mb-2">Email sent</h2>
            <p className="text-sm text-slate-500 text-center mb-6">
              Check your inbox for a new verification link. It expires in 14 days.
            </p>
            <Link
              href="/login"
              className="block w-full text-center text-sm text-slate-500 hover:text-slate-700"
            >
              Back to sign in
            </Link>
          </>
        ) : status === "expired" ? (
          <>
            <div className="flex justify-center mb-5">
              <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
                <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 text-center mb-2">Account expired</h2>
            <p className="text-sm text-slate-500 text-center mb-4">
              Your verification window has expired and your account has been deactivated.
            </p>
            <p className="text-sm text-slate-500 text-center mb-6">
              If you were added by a campaign manager, please ask them to re-add you. If you registered as a candidate, you can create a new account.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/register"
                className="block w-full text-center h-11 leading-[44px] rounded-2xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
              >
                Register again
              </Link>
              <Link href="/login" className="block w-full text-center text-sm text-slate-400 hover:text-slate-600 py-1">
                Sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-slate-900 mb-1">Resend verification</h2>
            <p className="text-sm text-slate-500 mb-6">
              Enter your email address and we&apos;ll send a new verification link.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  autoFocus
                  className="h-12 w-full rounded-2xl border border-slate-200 hover:border-slate-300 bg-white px-4 text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              {status === "error" && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                  <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="h-12 w-full rounded-2xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {status === "loading" ? "Sending…" : "Send verification email"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500">
              <Link href="/login" className="text-brand-600 font-medium hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-slate-400">LocalSeat &mdash; Built for Canadian municipal campaigns</p>
    </div>
  );
}
