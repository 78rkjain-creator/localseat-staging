"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDonor, deleteDonor } from "../actions";
import type { DonorStatus, PaymentMethod } from "@/types";
import { DONOR_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/types";

// ── This page is a client component so inline editing works without extra route ──

interface DonorDetailClientProps {
  donor: {
    id: string;
    firstName: string;
    lastName: string;
    address: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    phone: string | null;
    email: string | null;
    amount: string | null;
    donationDate: Date | null;
    status: string;
    paymentMethod: string | null;
    thankYouSent: boolean;
    thankYouDate: Date | null;
    notes: string | null;
    linkedPerson: { id: string; firstName: string; lastName: string } | null;
    createdBy: { firstName: string; lastName: string } | null;
    createdAt: Date;
  };
  showAmounts: boolean;
  readOnly?: boolean;
}

export function DonorDetailClient({ donor, showAmounts, readOnly = false }: DonorDetailClientProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startSave(async () => {
      const result = await updateDonor({
        donorId: donor.id,
        firstName: fd.get("firstName") as string,
        lastName: fd.get("lastName") as string,
        address: fd.get("address") as string,
        city: fd.get("city") as string,
        province: fd.get("province") as string,
        postalCode: fd.get("postalCode") as string,
        phone: fd.get("phone") as string,
        email: fd.get("email") as string,
        amount: fd.get("amount") as string,
        donationDate: fd.get("donationDate") as string,
        status: fd.get("status") as DonorStatus,
        paymentMethod: (fd.get("paymentMethod") as PaymentMethod | "") || "",
        thankYouSent: fd.get("thankYouSent") === "yes",
        thankYouDate: fd.get("thankYouDate") as string,
        notes: fd.get("notes") as string,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteDonor(donor.id);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/donors");
      }
    });
  }

  const formatDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : null;

  const formatDateInput = (d: Date | null) =>
    d ? new Date(d).toISOString().split("T")[0] : "";

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input name="firstName" defaultValue={donor.firstName} required className={inputCls} />
          </Field>
          <Field label="Last name" required>
            <input name="lastName" defaultValue={donor.lastName} required className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input name="phone" type="tel" defaultValue={donor.phone ?? ""} className={inputCls} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={donor.email ?? ""} className={inputCls} />
          </Field>
        </div>

        <Field label="Address">
          <input name="address" defaultValue={donor.address ?? ""} className={inputCls} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="City">
            <input name="city" defaultValue={donor.city ?? ""} className={inputCls} />
          </Field>
          <Field label="Province">
            <input name="province" defaultValue={donor.province ?? ""} maxLength={2} className={`${inputCls} uppercase`} />
          </Field>
          <Field label="Postal code">
            <input name="postalCode" defaultValue={donor.postalCode ?? ""} className={`${inputCls} uppercase`} />
          </Field>
        </div>

        <Field label="Status">
          <select name="status" defaultValue={donor.status} className={selectCls}>
            <option value="interested">Interested</option>
            <option value="pledged">Pledged</option>
            <option value="received">Received</option>
          </select>
        </Field>

        {showAmounts && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount ($)">
                <input name="amount" type="number" min="0" step="0.01" defaultValue={donor.amount ?? ""} className={inputCls} />
              </Field>
              <Field label="Donation date">
                <input name="donationDate" type="date" defaultValue={formatDateInput(donor.donationDate)} className={inputCls} />
              </Field>
            </div>
            <Field label="Payment method">
              <select name="paymentMethod" defaultValue={donor.paymentMethod ?? ""} className={selectCls}>
                <option value="">Not specified</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="e_transfer">e-Transfer</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </>
        )}

        <Field label="Thank you sent">
          <select name="thankYouSent" defaultValue={donor.thankYouSent ? "yes" : "no"} className={selectCls}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </Field>
        <Field label="Thank you date">
          <input name="thankYouDate" type="date" defaultValue={formatDateInput(donor.thankYouDate)} className={inputCls} />
        </Field>

        <Field label="Notes">
          <textarea name="notes" rows={3} defaultValue={donor.notes ?? ""} className={`${inputCls} resize-none`} />
        </Field>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => setEditing(false)} className={cancelBtnCls}>
            Cancel
          </button>
          <button type="submit" disabled={savePending} className={primaryBtnCls}>
            {savePending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    );
  }

  // Read view
  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Status + amount */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={donor.status as DonorStatus} />
        {showAmounts && donor.amount && (
          <span className="text-lg font-semibold text-slate-900">
            ${Number(donor.amount).toLocaleString("en-CA", { minimumFractionDigits: 2 })}
          </span>
        )}
        {showAmounts && donor.paymentMethod && (
          <span className="text-sm text-slate-500">
            via {PAYMENT_METHOD_LABELS[donor.paymentMethod as PaymentMethod] ?? donor.paymentMethod}
          </span>
        )}
        {showAmounts && donor.donationDate && (
          <span className="text-sm text-slate-400">{formatDate(donor.donationDate)}</span>
        )}
      </div>

      {/* Contact */}
      <Section title="Contact">
        <dl className="flex flex-col gap-2.5">
          <Row label="Phone" value={donor.phone} />
          <Row label="Email" value={donor.email} />
          {(donor.address || donor.city) && (
            <Row
              label="Address"
              value={[donor.address, donor.city, donor.province, donor.postalCode].filter(Boolean).join(", ")}
            />
          )}
        </dl>
      </Section>

      {/* Thank you */}
      <Section title="Thank you">
        <dl className="flex flex-col gap-2.5">
          <Row label="Sent" value={donor.thankYouSent ? "Yes" : "No"} />
          {donor.thankYouDate && <Row label="Date" value={formatDate(donor.thankYouDate)} />}
        </dl>
      </Section>

      {/* Notes */}
      {donor.notes && (
        <Section title="Notes">
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{donor.notes}</p>
        </Section>
      )}

      {/* Linked voter */}
      {donor.linkedPerson && (
        <Section title="Linked voter record">
          <a
            href={`/people/${donor.linkedPerson.id}`}
            className="text-sm text-brand-600 hover:underline"
          >
            {donor.linkedPerson.firstName} {donor.linkedPerson.lastName}
          </a>
        </Section>
      )}

      {/* Meta */}
      <p className="text-xs text-slate-400">
        Added {formatDate(donor.createdAt)}
        {donor.createdBy ? ` by ${donor.createdBy.firstName} ${donor.createdBy.lastName}` : ""}
      </p>

      {/* Actions */}
      {!readOnly && (
        <div className="flex gap-3 pt-2">
          <button onClick={() => setEditing(true)} className={primaryBtnCls}>
            Edit donor
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-4 py-2 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={deletePending}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deletePending ? "Deleting…" : "Confirm delete"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-4">
      <dt className="text-xs text-slate-400 w-24 flex-shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: DonorStatus }) {
  const styles: Record<DonorStatus, string> = {
    interested: "bg-amber-50 text-amber-700 border-amber-200",
    pledged:    "bg-blue-50 text-blue-700 border-blue-200",
    received:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium border ${styles[status]}`}>
      {DONOR_STATUS_LABELS[status]}
    </span>
  );
}

const inputCls = "px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-full";
const selectCls = "px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 w-full";
const primaryBtnCls = "px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors";
const cancelBtnCls = "px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors";
