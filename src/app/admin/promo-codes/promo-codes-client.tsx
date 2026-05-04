"use client";

import { useState } from "react";
import Link from "next/link";
import { createPromoCodeAction, togglePromoCodeAction } from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────

interface PromoCodeRow {
  id: string;
  code: string;
  referrerName: string;
  referrerEmail: string | null;
  discountPercent: number;
  stripeCouponId: string | null;
  isActive: boolean;
  maxUses: number | null;
  usageCount: number;
  totalRevenue: number;
  totalDiscounts: number;
  expiresAt: Date | null;
  createdAt: Date;
}

interface Props {
  codes: PromoCodeRow[];
}

// ── Status badge ───────────────────────────────────────────────────────────

function statusInfo(code: PromoCodeRow): { label: string; className: string } {
  if (!code.isActive) return { label: "Inactive", className: "bg-slate-100 text-slate-500" };
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) return { label: "Expired", className: "bg-amber-100 text-amber-700" };
  if (code.maxUses !== null && code.usageCount >= code.maxUses) return { label: "Maxed out", className: "bg-amber-100 text-amber-700" };
  return { label: "Active", className: "bg-emerald-100 text-emerald-700" };
}

// ── Create form ────────────────────────────────────────────────────────────

function CreateForm() {
  const [code, setCode] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [referrerEmail, setReferrerEmail] = useState("");
  const [discountPercent, setDiscountPercent] = useState(5);
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const result = await createPromoCodeAction({
      code,
      referrerName,
      referrerEmail: referrerEmail || undefined,
      discountPercent,
      maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
      expiresAt: expiresAt || undefined,
    });

    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(`Code "${code.toUpperCase()}" created.`);
      setCode("");
      setReferrerName("");
      setReferrerEmail("");
      setDiscountPercent(5);
      setMaxUses("");
      setExpiresAt("");
    }
  }

  const INPUT = "h-9 w-full rounded-lg border border-slate-200 hover:border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors";
  const LABEL = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
      <h2 className="text-base font-semibold text-slate-900 mb-5">Create promo code</h2>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className={LABEL}>Code *</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
              placeholder="JOHN2026"
              required
              className={INPUT + " font-mono tracking-wide"}
            />
          </div>
          <div>
            <label className={LABEL}>Referrer name *</label>
            <input
              type="text"
              value={referrerName}
              onChange={(e) => setReferrerName(e.target.value)}
              placeholder="John Smith"
              required
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Referrer email</label>
            <input
              type="email"
              value={referrerEmail}
              onChange={(e) => setReferrerEmail(e.target.value)}
              placeholder="john@example.com"
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Discount %</label>
            <input
              type="number"
              min={1}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(parseInt(e.target.value, 10) || 5)}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Max uses (blank = unlimited)</label>
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>Expiry date (optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
            <p className="text-sm text-emerald-700 font-medium">{success}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="h-9 px-5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Creating…" : "Create code"}
        </button>
      </form>
    </div>
  );
}

// ── Row actions ────────────────────────────────────────────────────────────

function ToggleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    await togglePromoCodeAction(id, !isActive);
    setBusy(false);
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2 transition-colors disabled:opacity-50"
    >
      {busy ? "…" : isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}

// ── Main client component ──────────────────────────────────────────────────

export function PromoCodesClient({ codes }: Props) {
  return (
    <>
      <CreateForm />

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">All codes ({codes.length})</h2>
        </div>

        {codes.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-400">No promo codes yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Referrer</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Discount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Uses</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Discounts</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {codes.map((c) => {
                  const { label, className } = statusInfo(c);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-semibold text-slate-900">{c.code}</span>
                        {!c.stripeCouponId && (
                          <span className="ml-2 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">no Stripe coupon</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-slate-900 font-medium">{c.referrerName}</p>
                        {c.referrerEmail && <p className="text-slate-400 text-xs">{c.referrerEmail}</p>}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-900">{c.discountPercent}%</td>
                      <td className="px-4 py-4 text-right text-slate-600">
                        {c.usageCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ""}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-900 font-medium">
                        ${c.totalRevenue.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-500">
                        ${c.totalDiscounts.toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString("en-CA")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4 justify-end">
                          <Link
                            href={`/admin/promo-codes/${c.id}`}
                            className="text-xs font-medium text-brand-600 hover:text-brand-700 underline underline-offset-2 transition-colors whitespace-nowrap"
                          >
                            View campaigns
                          </Link>
                          <ToggleButton id={c.id} isActive={c.isActive} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
