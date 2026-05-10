"use client";

import { useState, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { submitBugReport } from "@/app/(app)/bug-report/actions";

type Severity = "minor" | "major" | "blocking";

const SEVERITY_OPTIONS: { value: Severity; label: string; color: string }[] = [
  { value: "minor",    label: "Minor",    color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "major",    label: "Major",    color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "blocking", label: "Blocking", color: "bg-red-50 text-red-700 border-red-200" },
];

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("minor");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setDescription("");
    setSeverity("minor");
    setScreenshot(null);
    setError(null);
    setSubmitted(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    setOpen(false);
    // Reset after animation
    setTimeout(resetForm, 200);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      setError("Screenshot must be under 5MB.");
      e.target.value = "";
      return;
    }

    // Image types only
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      e.target.value = "";
      return;
    }

    setError(null);
    setScreenshot(file);
  }

  async function handleSubmit() {
    if (!description.trim()) {
      setError("Please describe the issue.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("description", description.trim());
      formData.set("severity", severity);
      formData.set("currentUrl", window.location.href);
      formData.set("userAgent", navigator.userAgent);

      if (screenshot) {
        formData.set("screenshot", screenshot);
      }

      const result = await submitBugReport(formData);

      if (result?.error) {
        setError(result.error);
      } else {
        setSubmitted(true);
        setTimeout(handleClose, 1500);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Floating button — bottom-right, above mobile nav */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-4 z-40 flex items-center gap-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white px-4 h-11 rounded-full shadow-lg transition-colors"
        aria-label="Report a bug"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <span className="text-sm font-medium hidden sm:inline">Report Bug</span>
      </button>

      {/* Modal */}
      <Modal open={open} onClose={handleClose} title="Report a Bug">
        {submitted ? (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-slate-700 font-medium">Bug report sent. Thank you!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Description */}
            <div>
              <label htmlFor="bug-description" className="block text-sm font-medium text-slate-700 mb-1">
                What happened?
              </label>
              <textarea
                id="bug-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue — what did you expect vs what happened?"
                rows={4}
                maxLength={2000}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Severity
              </label>
              <div className="flex gap-2">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSeverity(opt.value)}
                    className={[
                      "flex-1 h-10 rounded-xl text-sm font-medium border transition-colors",
                      severity === opt.value
                        ? opt.color + " ring-2 ring-brand-500 ring-offset-1"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Screenshot */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Screenshot <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="text-sm text-slate-500 file:mr-3 file:h-9 file:px-4 file:rounded-xl file:border file:border-slate-200 file:bg-white file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50 file:cursor-pointer file:transition-colors"
                />
                {screenshot && (
                  <button
                    type="button"
                    onClick={() => {
                      setScreenshot(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            {/* Context note */}
            <p className="text-xs text-slate-400">
              Your name, role, page URL, and device info will be included automatically.
            </p>

            {/* Submit */}
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={submitting}
                className="flex-1"
              >
                Send Report
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
