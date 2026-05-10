"use client";

import { useState, useRef } from "react";

interface Props {
  currentLogoUrl: string | null;
}

export function CampaignLogoUpload({ currentLogoUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await fetch("/api/campaign/logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setLogoUrl(data.logoUrl);
      } else {
        setError(data.error ?? "Upload failed.");
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/campaign/logo", { method: "DELETE" });
      if (res.ok) {
        setLogoUrl(null);
      }
    } catch {
      setError("Failed to remove logo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-5">
      <p className="text-sm font-semibold text-slate-700 mb-1">Campaign logo</p>
      <p className="text-xs text-slate-400 mb-4">
        Displayed in the sidebar and canvasser dashboard. PNG, JPEG, WebP, or SVG. Max 512KB.
      </p>

      {logoUrl ? (
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
            <img src={logoUrl} alt="Campaign logo" className="max-h-12 max-w-12 object-contain" />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="h-8 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="h-8 px-3 rounded-xl border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-10 px-4 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-brand-300 hover:text-brand-600 transition-colors disabled:opacity-50 w-full"
        >
          {uploading ? "Uploading…" : "Upload logo"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleUpload}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}
    </div>
  );
}
