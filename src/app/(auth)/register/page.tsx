"use client";

import { useState, useRef, FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { register } from "./actions";
import { TERMS_V1_3_HTML } from "@/lib/terms";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneHome, setPhoneHome] = useState("");
  const [phoneMobile, setPhoneMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Terms state
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [termsSignedName, setTermsSignedName] = useState("");
  const [termsChecked, setTermsChecked] = useState(false);
  const termsBoxRef = useRef<HTMLDivElement>(null);

  const termsComplete = scrolledToBottom && termsSignedName.trim().length > 0 && termsChecked;
  const canSubmit = !loading && termsComplete;

  function handleTermsScroll() {
    const el = termsBoxRef.current;
    if (!el || scrolledToBottom) return;
    // Allow a 20px buffer so users aren't pixel-hunting
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setScrolledToBottom(true);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!termsComplete) {
      setError("Please scroll through the Terms and Conditions, sign, and check the agreement box.");
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        firstName,
        lastName,
        email,
        phoneHome,
        phoneMobile,
        password,
        termsSignedName: termsSignedName.trim(),
      });
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      // Sign in with the newly created credentials
      const signInResult = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (signInResult?.error || !signInResult?.ok) {
        setError("Account created but sign-in failed. Please sign in manually.");
        setLoading(false);
        return;
      }
      // Hard navigate so the session cookie is picked up before RSC
      window.location.href = "/onboarding/choose-plan";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-brand-500 flex items-center justify-center shadow-soft">
          <svg
            className="h-7 w-7 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            LocalSeat
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Municipal campaign platform</p>
        </div>
      </div>

      {/* Register card */}
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-card border border-slate-100 p-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-1">Create an account</h2>
        <p className="text-sm text-slate-500 mb-6">
          Set up your account to get started.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jane"
              autoComplete="given-name"
              autoFocus
              required
            />
            <Input
              label="Last name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Smith"
              autoComplete="family-name"
              required
            />
          </div>

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <Input
            label="Phone (optional)"
            type="tel"
            value={phoneHome}
            onChange={(e) => setPhoneHome(e.target.value)}
            placeholder="613-555-0100"
            autoComplete="tel"
          />

          <Input
            label="Mobile phone (optional)"
            type="tel"
            value={phoneMobile}
            onChange={(e) => setPhoneMobile(e.target.value)}
            placeholder="613-555-0100"
            autoComplete="tel"
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={8}
                className="h-12 w-full rounded-2xl border border-slate-200 hover:border-slate-300 bg-white px-4 pr-12 text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-1 my-auto h-10 w-10 z-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <Input
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />

          {/* ── Terms and Conditions ───────────────────────────────────────── */}
          <div className="flex flex-col gap-3 pt-2">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">
                Terms and Conditions
              </p>
              <p className="text-xs text-slate-500 mb-2">
                Scroll to the bottom to unlock the signature field.
              </p>

              {/* Scrollable terms box */}
              <div
                ref={termsBoxRef}
                onScroll={handleTermsScroll}
                className="h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700 leading-relaxed terms-content"
                tabIndex={0}
                aria-label="Terms and Conditions — scroll to read"
              >
                <div
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: TERMS_V1_3_HTML }}
                />
              </div>

              {/* Scroll progress indicator */}
              {!scrolledToBottom && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  Scroll to the bottom to continue
                </p>
              )}
              {scrolledToBottom && (
                <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  You have read the full Terms and Conditions
                </p>
              )}
            </div>

            {/* Electronic signature */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="termsSignedName"
                className={[
                  "text-sm font-medium transition-colors",
                  scrolledToBottom ? "text-slate-700" : "text-slate-400",
                ].join(" ")}
              >
                Electronic signature
              </label>
              <input
                id="termsSignedName"
                type="text"
                value={termsSignedName}
                onChange={(e) => setTermsSignedName(e.target.value)}
                placeholder="Type your full legal name"
                disabled={!scrolledToBottom}
                autoComplete="name"
                className={[
                  "h-12 w-full rounded-2xl border bg-white px-4 text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent",
                  scrolledToBottom
                    ? "border-slate-200 hover:border-slate-300"
                    : "border-slate-100 bg-slate-50 cursor-not-allowed",
                ].join(" ")}
              />
              {scrolledToBottom && (
                <p className="text-xs text-slate-400">
                  This constitutes your legally binding electronic signature.
                </p>
              )}
            </div>

            {/* Agreement checkbox */}
            <label
              className={[
                "flex items-start gap-3 cursor-pointer rounded-xl border p-3 transition-colors",
                !scrolledToBottom
                  ? "opacity-50 cursor-not-allowed border-slate-100 bg-slate-50"
                  : termsChecked
                  ? "border-brand-200 bg-brand-50"
                  : "border-slate-200 bg-white hover:bg-slate-50",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                disabled={!scrolledToBottom}
                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                I have read and agree to the LocalSeat.io Terms and Conditions,
                including the post-campaign data provisions in{" "}
                <strong>section 4.4</strong> and the data deletion rights in{" "}
                <strong>section 4.6</strong>.
              </span>
            </label>
          </div>

          {/* ── Error + Submit ─────────────────────────────────────────────── */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={loading}
            disabled={!canSubmit}
            className="mt-1"
          >
            Create account
          </Button>

          {!termsComplete && !error && (
            <p className="text-xs text-center text-slate-400">
              Complete the Terms and Conditions section above to create your account.
            </p>
          )}
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <p className="mt-8 text-xs text-slate-400">
        LocalSeat &mdash; Built for Canadian municipal campaigns
      </p>
    </div>
  );
}
