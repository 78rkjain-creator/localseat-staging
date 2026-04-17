"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePerson } from "./actions";
import { SUPPORT_LEVEL_LABELS } from "@/types";
import type { SupportLevel } from "@/types";

interface PersonEditFormProps {
  personId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneHome: string | null;
  phoneMobile: string | null;
  birthYear: number | null;
  supportLevel: string | null;
  pollNumber: string | null;
}

export function PersonEditForm({
  personId,
  firstName,
  lastName,
  email,
  phoneHome,
  phoneMobile,
  birthYear,
  supportLevel,
  pollNumber,
}: PersonEditFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const rawYear = (fd.get("birthYear") as string).trim();
    const parsedYear = rawYear ? parseInt(rawYear, 10) : null;

    startTransition(async () => {
      const result = await updatePerson({
        personId,
        firstName: fd.get("firstName") as string,
        lastName: fd.get("lastName") as string,
        email: fd.get("email") as string,
        phoneHome: fd.get("phoneHome") as string,
        phoneMobile: fd.get("phoneMobile") as string,
        birthYear: parsedYear,
        supportLevel: (fd.get("supportLevel") as SupportLevel) || null,
        pollNumber: (fd.get("pollNumber") as string) || null,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function handleCancel() {
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Contact
          </h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-7 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Edit
          </button>
        </div>
        <dl className="flex flex-col gap-3">
          <ReadRow label="Name" value={`${firstName} ${lastName}`} />
          <ReadRow
            label="Email"
            value={
              email ? (
                <a href={`mailto:${email}`} className="text-brand-600 hover:underline">
                  {email}
                </a>
              ) : null
            }
          />
          <ReadRow
            label="Home phone"
            value={
              phoneHome ? (
                <a href={`tel:${phoneHome}`} className="text-brand-600 hover:underline">
                  {phoneHome}
                </a>
              ) : null
            }
          />
          <ReadRow
            label="Mobile phone"
            value={
              phoneMobile ? (
                <a href={`tel:${phoneMobile}`} className="text-brand-600 hover:underline">
                  {phoneMobile}
                </a>
              ) : null
            }
          />
          <ReadRow label="Birth year" value={birthYear ? String(birthYear) : null} />
          <ReadRow label="Support level" value={SUPPORT_LEVEL_LABELS[supportLevel as SupportLevel] ?? null} />
          <ReadRow label="Poll number" value={pollNumber} />
        </dl>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
        Contact
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input name="firstName" defaultValue={firstName} required className={inputCls} />
          </Field>
          <Field label="Last name" required>
            <input name="lastName" defaultValue={lastName} required className={inputCls} />
          </Field>
        </div>

        <Field label="Email">
          <input name="email" type="email" defaultValue={email ?? ""} className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Home phone">
            <input name="phoneHome" type="tel" defaultValue={phoneHome ?? ""} className={inputCls} />
          </Field>
          <Field label="Mobile phone">
            <input name="phoneMobile" type="tel" defaultValue={phoneMobile ?? ""} className={inputCls} />
          </Field>
        </div>

        <Field label="Birth year">
          <input
            name="birthYear"
            type="number"
            defaultValue={birthYear ?? ""}
            min={1900}
            max={new Date().getFullYear()}
            className={inputCls}
          />
        </Field>

        <Field label="Support level">
          <select name="supportLevel" defaultValue={supportLevel ?? ""} className={inputCls}>
            <option value="">— Not set —</option>
            <option value="strong_yes">Strong Yes</option>
            <option value="soft_yes">Soft Yes</option>
            <option value="undecided">Undecided</option>
            <option value="soft_no">Soft No</option>
            <option value="strong_no">Strong No</option>
          </select>
        </Field>

        <Field label="Poll number">
          <input name="pollNumber" defaultValue={pollNumber ?? ""} className={inputCls} />
        </Field>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 mt-1">
          <button
            type="submit"
            disabled={pending}
            className="h-9 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-slate-800 mt-0.5">
        {value ?? <span className="text-slate-300">Not recorded</span>}
      </dd>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full";
