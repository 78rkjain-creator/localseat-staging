"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePerson, updatePersonAddress } from "./actions";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { SUPPORT_LEVEL_LABELS } from "@/types";
import type { SupportLevel } from "@/types";

interface PersonAddress {
  streetNumber: string;
  streetName: string;
  unitNumber: string | null;
  city: string;
  province: string;
  postalCode: string;
}

interface PersonEditFormProps {
  personId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneHome: string | null;
  phoneMobile: string | null;
  birthDate: Date | null;
  supportLevel: SupportLevel | null;
  pollNumber: string | null;
  wardStatus?: string;
  readOnly?: boolean;
  address?: PersonAddress;
}

export function PersonEditForm({
  personId,
  firstName,
  lastName,
  email,
  phoneHome,
  phoneMobile,
  birthDate,
  supportLevel,
  pollNumber,
  wardStatus: _wardStatus,
  readOnly = false,
  address,
}: PersonEditFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Address controlled state (only relevant when address prop is provided)
  const [addrStreetNumber, setAddrStreetNumber] = useState(address?.streetNumber ?? "");
  const [addrStreetName, setAddrStreetName] = useState(address?.streetName ?? "");
  const [addrUnitNumber, setAddrUnitNumber] = useState(address?.unitNumber ?? "");
  const [addrCity, setAddrCity] = useState(address?.city ?? "");
  const [addrProvince, setAddrProvince] = useState(address?.province ?? "ON");
  const [addrPostalCode, setAddrPostalCode] = useState(address?.postalCode ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const personResult = await updatePerson({
        personId,
        firstName: fd.get("firstName") as string,
        lastName: fd.get("lastName") as string,
        email: fd.get("email") as string,
        phoneHome: fd.get("phoneHome") as string,
        phoneMobile: fd.get("phoneMobile") as string,
        birthDate: (fd.get("birthDate") as string) || null,
        supportLevel: (fd.get("supportLevel") as SupportLevel) || null,
        pollNumber: (fd.get("pollNumber") as string) || null,
      });

      if (personResult.error) {
        setError(personResult.error);
        return;
      }

      if (address) {
        const addrResult = await updatePersonAddress({
          personId,
          streetNumber: addrStreetNumber,
          streetName: addrStreetName,
          unitNumber: addrUnitNumber,
          city: addrCity,
          province: addrProvince,
          postalCode: addrPostalCode,
        });
        if (addrResult.error) {
          setError(addrResult.error);
          return;
        }
      }

      setEditing(false);
      router.refresh();
    });
  }

  function handleCancel() {
    setError(null);
    setEditing(false);
    setAddrStreetNumber(address?.streetNumber ?? "");
    setAddrStreetName(address?.streetName ?? "");
    setAddrUnitNumber(address?.unitNumber ?? "");
    setAddrCity(address?.city ?? "");
    setAddrProvince(address?.province ?? "ON");
    setAddrPostalCode(address?.postalCode ?? "");
  }

  // ── Read-only view ──────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Contact
          </h2>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-7 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Edit
            </button>
          )}
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
          <ReadRow
            label="Birth date"
            value={birthDate ? new Date(birthDate).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : null}
          />
          <ReadRow label="Support level" value={SUPPORT_LEVEL_LABELS[supportLevel as SupportLevel] ?? null} />
          {pollNumber && <ReadRow label="Poll number" value={pollNumber} />}
        </dl>
      </div>
    );
  }

  // ── Edit view ───────────────────────────────────────────────────────────────

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
        Contact
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input
              name="firstName"
              defaultValue={firstName}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Last name" required>
            <input
              name="lastName"
              defaultValue={lastName}
              required
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Email">
          <input
            name="email"
            type="email"
            defaultValue={email ?? ""}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Home phone">
            <input
              name="phoneHome"
              type="tel"
              defaultValue={phoneHome ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Mobile phone">
            <input
              name="phoneMobile"
              type="tel"
              defaultValue={phoneMobile ?? ""}
              className={inputCls}
            />
          </Field>
        </div>

        {address && (
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Address</p>
            <AddressAutocomplete
              onSelect={(parsed) => {
                setAddrStreetNumber(parsed.streetNumber);
                setAddrStreetName(parsed.streetName);
                setAddrCity(parsed.city);
                setAddrProvince(parsed.province);
                setAddrPostalCode(parsed.postalCode);
              }}
              placeholder="Search for a new address…"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                value={addrStreetNumber}
                onChange={(e) => setAddrStreetNumber(e.target.value)}
                placeholder="No."
                className={inputCls}
              />
              <div className="col-span-2">
                <input
                  value={addrStreetName}
                  onChange={(e) => setAddrStreetName(e.target.value)}
                  placeholder="Street name"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={addrUnitNumber}
                onChange={(e) => setAddrUnitNumber(e.target.value)}
                placeholder="Unit"
                className={inputCls}
              />
              <div className="col-span-2">
                <input
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  placeholder="City"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={addrProvince}
                onChange={(e) => setAddrProvince(e.target.value)}
                placeholder="Province"
                className={inputCls}
              />
              <input
                value={addrPostalCode}
                onChange={(e) => setAddrPostalCode(e.target.value)}
                placeholder="Postal code"
                className={inputCls}
              />
            </div>
          </div>
        )}

        <Field label="Birth date">
          <input
            name="birthDate"
            type="date"
            defaultValue={birthDate ? new Date(birthDate).toISOString().slice(0, 10) : ""}
            min="1900-01-01"
            max={`${new Date().getFullYear()}-12-31`}
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
          <input
            name="pollNumber"
            defaultValue={pollNumber ?? ""}
            placeholder="e.g. 001A"
            className={inputCls}
          />
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function ReadRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-sm text-slate-800 mt-0.5">
        {value ?? <span className="text-slate-300">Not recorded</span>}
      </dd>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
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
