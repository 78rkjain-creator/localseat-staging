"use client";

import { useState, FormEvent } from "react";
import { updateProfile, updatePassword } from "./actions";

interface ProfileFormProps {
  firstName: string;
  lastName: string;
  email: string;
  phoneHome: string | null;
  phoneMobile: string | null;
}

export function ProfileForm({ firstName, lastName, email, phoneHome, phoneMobile }: ProfileFormProps) {
  // ── Personal info state ───────────────────────────────────────────────────
  const [pFirst, setPFirst] = useState(firstName);
  const [pLast, setPLast] = useState(lastName);
  const [pEmail, setPEmail] = useState(email);
  const [pPhone, setPPhone] = useState(phoneHome ?? "");
  const [pMobile, setPMobile] = useState(phoneMobile ?? "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // ── Password state ────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    setProfileLoading(true);
    const result = await updateProfile({ firstName: pFirst, lastName: pLast, email: pEmail, phoneHome: pPhone, phoneMobile: pMobile });
    setProfileLoading(false);
    if (result.error) { setProfileError(result.error); return; }
    setProfileSuccess(true);
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    setPwLoading(true);
    const result = await updatePassword({ currentPassword: currentPw, newPassword: newPw });
    setPwLoading(false);
    if (result.error) { setPwError(result.error); return; }
    setPwSuccess(true);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
  }

  return (
    <div className="space-y-6">

      {/* ── Personal info ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Personal information</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">First name</label>
              <input
                type="text"
                value={pFirst}
                onChange={(e) => setPFirst(e.target.value)}
                required
                className="h-11 rounded-xl border border-slate-200 hover:border-slate-300 bg-white px-3.5 text-slate-900 placeholder:text-slate-400 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Last name</label>
              <input
                type="text"
                value={pLast}
                onChange={(e) => setPLast(e.target.value)}
                required
                className="h-11 rounded-xl border border-slate-200 hover:border-slate-300 bg-white px-3.5 text-slate-900 placeholder:text-slate-400 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={pEmail}
              onChange={(e) => setPEmail(e.target.value)}
              required
              className="h-11 rounded-xl border border-slate-200 hover:border-slate-300 bg-white px-3.5 text-slate-900 placeholder:text-slate-400 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Phone (home) <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                value={pPhone}
                onChange={(e) => setPPhone(e.target.value)}
                placeholder="613-555-0100"
                className="h-11 rounded-xl border border-slate-200 hover:border-slate-300 bg-white px-3.5 text-slate-900 placeholder:text-slate-400 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Phone (mobile) <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                value={pMobile}
                onChange={(e) => setPMobile(e.target.value)}
                placeholder="613-555-0100"
                className="h-11 rounded-xl border border-slate-200 hover:border-slate-300 bg-white px-3.5 text-slate-900 placeholder:text-slate-400 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          </div>

          {profileError && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{profileError}</p>
            </div>
          )}
          {profileSuccess && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
              <p className="text-sm text-emerald-700">Profile updated.</p>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={profileLoading}
              className="h-10 px-5 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {profileLoading ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Change password ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Change password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Current password</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              autoComplete="current-password"
              className="h-11 rounded-xl border border-slate-200 hover:border-slate-300 bg-white px-3.5 text-slate-900 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">New password</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="h-11 rounded-xl border border-slate-200 hover:border-slate-300 bg-white px-3.5 text-slate-900 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Confirm new password</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              autoComplete="new-password"
              className="h-11 rounded-xl border border-slate-200 hover:border-slate-300 bg-white px-3.5 text-slate-900 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {pwError && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm text-red-600">{pwError}</p>
            </div>
          )}
          {pwSuccess && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
              <p className="text-sm text-emerald-700">Password updated.</p>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={pwLoading}
              className="h-10 px-5 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {pwLoading ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
