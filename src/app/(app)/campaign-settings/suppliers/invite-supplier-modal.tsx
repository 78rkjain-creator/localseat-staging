"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { inviteSupplier } from "./actions";

interface Props {
  sessionFirstName: string;
  sessionLastName: string;
  sessionEmail: string;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function InviteSupplierModal({ sessionFirstName, sessionLastName, sessionEmail }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [supplierLoginEmail, setSupplierLoginEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState(() => generatePassword());

  // Step 2 fields
  const [signedName, setSignedName] = useState("");
  const [signedEmail, setSignedEmail] = useState("");
  const sigPadRef = useRef<SignaturePadHandle>(null);
  const [sigEmpty, setSigEmpty] = useState(true);

  // Result state
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const expectedName = `${sessionFirstName} ${sessionLastName}`;
  const nameMatches = signedName.trim().toLowerCase() === expectedName.toLowerCase();
  const emailMatches = signedEmail.trim().toLowerCase() === sessionEmail.toLowerCase();
  const canSubmit = nameMatches && emailMatches && !sigEmpty && !isPending;

  function open() {
    setStep(1);
    setCompanyName("");
    setCompanyEmail("");
    setCompanyPhone("");
    setSupplierLoginEmail("");
    setTemporaryPassword(generatePassword());
    setSignedName("");
    setSignedEmail("");
    setSigEmpty(true);
    setCredentials(null);
    setError(null);
    setIsOpen(true);
  }

  function close() {
    if (isPending) return;
    setIsOpen(false);
  }

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isPending]);

  function handleStep1Next() {
    if (!companyName.trim() || !companyEmail.trim() || !supplierLoginEmail.trim() || !temporaryPassword) {
      setError("Please fill in all required fields.");
      return;
    }
    setError(null);
    setStep(2);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const signatureData = sigPadRef.current?.getDataURL() ?? "";
    if (!signatureData) { setError("Signature is required."); return; }

    setError(null);
    startTransition(async () => {
      const result = await inviteSupplier({
        companyName: companyName.trim(),
        companyEmail: companyEmail.trim(),
        companyPhone: companyPhone.trim(),
        supplierLoginEmail: supplierLoginEmail.trim(),
        temporaryPassword,
        signedName: signedName.trim(),
        signedEmail: signedEmail.trim(),
        signatureData,
      });
      if (result.error) {
        setError(result.error);
      } else if (result.credentials) {
        setCredentials(result.credentials);
        setError(null);
      }
    });
  }

  function copyCredentials() {
    if (!credentials) return;
    navigator.clipboard.writeText(`Email: ${credentials.email}\nPassword: ${credentials.password}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors flex-shrink-0"
      >
        Invite supplier
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl px-6 py-6 sm:px-8 sm:py-7 max-h-[92dvh] overflow-y-auto sm:mx-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Invite data supplier</h2>
                <p className="text-xs text-slate-400 mt-0.5">Step {step} of 2</p>
              </div>
              <button
                onClick={close}
                disabled={isPending}
                className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Success state */}
            {credentials ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">Supplier account created</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">Share these credentials with your supplier:</p>
                <div className="bg-slate-50 rounded-xl p-4 mb-4 font-mono text-sm">
                  <p className="text-slate-700">Email: <span className="text-slate-900 font-semibold">{credentials.email}</span></p>
                  <p className="text-slate-700 mt-1">Password: <span className="text-slate-900 font-semibold">{credentials.password}</span></p>
                </div>
                <button
                  type="button"
                  onClick={copyCredentials}
                  className="w-full h-10 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors mb-3"
                >
                  Copy credentials
                </button>
                <p className="text-xs text-slate-400 text-center mb-4">
                  They can sign in at the LocalSeat login page.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="w-full h-11 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : step === 1 ? (
              /* Step 1 — Supplier details */
              <div>
                <div className="flex flex-col gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Company name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
                      placeholder="Acme Data Services"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Company email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
                      placeholder="contact@acme.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Company phone <span className="text-xs text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Supplier login email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={supplierLoginEmail}
                      onChange={(e) => setSupplierLoginEmail(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
                      placeholder="The email they'll use to sign in"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Temporary password <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={temporaryPassword}
                        onChange={(e) => setTemporaryPassword(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                      <button
                        type="button"
                        onClick={() => setTemporaryPassword(generatePassword())}
                        className="px-3 h-10 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleStep1Next}
                  className="w-full h-11 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Next — Sign acknowledgement
                </button>
              </div>
            ) : (
              /* Step 2 — Acknowledgement and signature */
              <div>
                {/* Warning card */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
                  <div className="flex items-start gap-2 mb-2">
                    <svg className="h-[18px] w-[18px] text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm font-semibold text-slate-800">Third-party data upload acknowledgement</p>
                  </div>
                  <div className="text-sm text-slate-700 space-y-1.5 ml-6">
                    <p>By signing below, you acknowledge that:</p>
                    <p>• You are authorizing <strong>{companyName}</strong> ({supplierLoginEmail}) to upload voter and resident data into this campaign</p>
                    <p>• LocalSeat does not verify, validate, or guarantee the quality, accuracy, or completeness of data uploaded by third-party suppliers</p>
                    <p>• You are responsible for reviewing all uploaded data before approving it for use in your campaign</p>
                    <p>• Any data uploaded by the supplier becomes part of your campaign records and is subject to your campaign's data handling obligations</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4 mb-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Sign your name
                    </label>
                    <input
                      type="text"
                      value={signedName}
                      onChange={(e) => setSignedName(e.target.value)}
                      className={[
                        "w-full h-10 px-3 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-400",
                        signedName && !nameMatches ? "border-red-300" : "border-slate-200",
                      ].join(" ")}
                      placeholder={expectedName}
                    />
                    {signedName && !nameMatches && (
                      <p className="text-xs text-red-500 mt-1">
                        Name must match your account name: {expectedName}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Confirm your email
                    </label>
                    <input
                      type="email"
                      value={signedEmail}
                      onChange={(e) => setSignedEmail(e.target.value)}
                      className={[
                        "w-full h-10 px-3 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-400",
                        signedEmail && !emailMatches ? "border-red-300" : "border-slate-200",
                      ].join(" ")}
                      placeholder={sessionEmail}
                    />
                    {signedEmail && !emailMatches && (
                      <p className="text-xs text-red-500 mt-1">Email must match your account email</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Signature
                    </label>
                    <div onPointerUp={() => setSigEmpty(sigPadRef.current?.isEmpty() ?? true)}>
                      <SignaturePad ref={sigPadRef} height={128} />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        sigPadRef.current?.clear();
                        setSigEmpty(true);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 mt-1 transition-colors"
                    >
                      Clear signature
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4">
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(null); }}
                    disabled={isPending}
                    className="flex-1 h-11 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="flex-1 h-11 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isPending ? "Creating…" : "Create supplier account"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
