"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerDemo } from "./actions";

const FEATURES = [
  "Voter contact management across your entire ward",
  "Mobile-first door-to-door canvassing",
  "Walk lists and turf assignment",
  "Donor prospect tracking",
  "Team and volunteer management",
];

const OFFICE_OPTIONS = [
  { value: "",                     label: "Select an office…" },
  { value: "Ward Councillor",      label: "Ward Councillor" },
  { value: "Mayor",                label: "Mayor" },
  { value: "School Board Trustee", label: "School Board Trustee" },
  { value: "Other",                label: "Other" },
];

export default function DemoPage() {
  const [firstName,    setFirstName]    = useState("");
  const [lastName,     setLastName]     = useState("");
  const [email,        setEmail]        = useState("");
  const [phone,        setPhone]        = useState("");
  const [municipality, setMunicipality] = useState("");
  const [officeType,   setOfficeType]   = useState("");
  const [error,        setError]        = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await registerDemo({ firstName, lastName, email, phone, municipality, officeType });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Auto-login as demo candidate
      const signInResult = await signIn("credentials", {
        email:    "alex.chen@example.com",
        password: "password",
        redirect: false,
      });

      if (!signInResult?.ok) {
        setError("Demo is temporarily unavailable. Please try again shortly.");
        setLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-500 flex items-center justify-center shadow-soft flex-shrink-0">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">LocalSeat</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">
        {/* Left — pitch */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider mb-2">Live demo</p>
            <h1 className="text-4xl font-bold text-slate-900 leading-tight tracking-tight">
              See LocalSeat.io<br />in action
            </h1>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              Explore a live municipal campaign — no setup, no credit card, no commitment required.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-slate-700 text-sm leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl bg-brand-50 border border-brand-100 px-5 py-4">
            <p className="text-sm text-brand-800 leading-relaxed">
              <strong>Built for Canadian municipal campaigns.</strong> Designed for the pace of door-knocking season — fast, mobile-first, and easy for volunteers with no training.
            </p>
          </div>
        </div>

        {/* Right — form */}
        <div className="bg-white rounded-3xl shadow-card border border-slate-100 p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-1">Start your demo</h2>
          <p className="text-sm text-slate-500 mb-6">You'll be inside the platform in seconds.</p>

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
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="613-555-0100"
              autoComplete="tel"
            />

            <Input
              label="Municipality (optional)"
              type="text"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              placeholder="e.g. Ottawa, Guelph, Burlington"
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="officeType" className="text-sm font-medium text-slate-700">
                Office sought (optional)
              </label>
              <select
                id="officeType"
                value={officeType}
                onChange={(e) => setOfficeType(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 hover:border-slate-300 bg-white px-4 text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                {OFFICE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
              Start your demo
            </Button>

            <p className="text-xs text-center text-slate-400 leading-relaxed">
              We&apos;ll use your information to follow up about LocalSeat.io.<br />
              We never share your data.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
