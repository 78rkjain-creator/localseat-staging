"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { verifyTokenAction } from "./actions";

type Status =
  | "loading"
  | "success_redirecting"
  | "success_logged_out"
  | "expired"
  | "invalid";

function VerifyEmailContent() {
  const [status, setStatus] = useState<Status>("loading");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update } = useSession();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    verifyTokenAction(token).then(async (result) => {
      if (result.success) {
        // Refresh the JWT so the proxy sees emailVerified: true
        await update({ refreshVerification: true });

        if (session?.user?.id) {
          setStatus("success_redirecting");
          router.push("/dashboard");
        } else {
          // No active session — user will need to sign in for a fresh token
          setStatus("success_logged_out");
        }
        return;
      }

      if (result.error === "already_verified") {
        // Already done — just get them to the right place
        await update({ refreshVerification: true });
        if (session?.user?.id) {
          router.push("/dashboard");
        } else {
          setStatus("success_logged_out");
        }
        return;
      }

      setStatus(result.error === "expired" ? "expired" : "invalid");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <AuthCard>
        {status === "loading" && (
          <>
            <div className="flex justify-center mb-5">
              <div className="h-8 w-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-center text-sm text-slate-500">Verifying your email…</p>
          </>
        )}

        {status === "success_redirecting" && (
          <>
            <CheckIcon />
            <h1 className="text-xl font-semibold text-slate-900 text-center mb-2">
              Email verified
            </h1>
            <p className="text-sm text-slate-500 text-center">Taking you to your dashboard…</p>
          </>
        )}

        {status === "success_logged_out" && (
          <>
            <CheckIcon />
            <h1 className="text-xl font-semibold text-slate-900 text-center mb-2">
              Email verified
            </h1>
            <p className="text-sm text-slate-500 text-center mb-6">
              Your account is active. Sign in to get started.
            </p>
            <Link
              href="/login"
              className="block w-full text-center h-11 leading-[44px] rounded-2xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
            >
              Sign in
            </Link>
          </>
        )}

        {status === "expired" && (
          <>
            <AlertIcon />
            <h1 className="text-xl font-semibold text-slate-900 text-center mb-2">
              Link expired
            </h1>
            <p className="text-sm text-slate-500 text-center mb-4">
              Your verification link has expired. Your account has been deactivated.
            </p>
            <p className="text-sm text-slate-500 text-center mb-6">
              If you registered as a candidate, you can create a new account. Otherwise contact your campaign manager.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/register"
                className="block w-full text-center h-11 leading-[44px] rounded-2xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
              >
                Register again
              </Link>
              <Link
                href="/login"
                className="block w-full text-center text-sm text-slate-500 hover:text-slate-700"
              >
                Sign in
              </Link>
            </div>
          </>
        )}

        {status === "invalid" && (
          <>
            <AlertIcon />
            <h1 className="text-xl font-semibold text-slate-900 text-center mb-2">
              Invalid link
            </h1>
            <p className="text-sm text-slate-500 text-center mb-6">
              This verification link is not valid. It may have already been used.
            </p>
            <Link
              href="/resend-verification"
              className="block w-full text-center h-11 leading-[44px] rounded-2xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Request a new link
            </Link>
          </>
        )}
      </AuthCard>

      <p className="mt-8 text-xs text-slate-400">LocalSeat &mdash; Built for Canadian municipal campaigns</p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="h-8 w-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

// ── Shared layout ─────────────────────────────────────────────────────────────

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-2xl bg-brand-500 flex items-center justify-center shadow-soft">
          <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">LocalSeat</h1>
      </div>
      <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-8">
        {children}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <div className="flex justify-center mb-5">
      <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center">
        <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>
  );
}

function AlertIcon() {
  return (
    <div className="flex justify-center mb-5">
      <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
        <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
    </div>
  );
}
