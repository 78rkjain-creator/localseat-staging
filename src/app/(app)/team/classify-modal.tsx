"use client";

import { useState, useTransition } from "react";
import { classifyTeamMember, type ClassifyTeamMemberInput } from "./classify-actions";
import { AddressPicker, addressValueComplete, type AddressValue } from "@/components/ui/address-picker";

type RadioOption = "inside" | "outside" | "unknown";

interface Props {
  personId: string;
  name: string;
  onDone: () => void;
}

export function TeamMemberClassifyModal({ personId, name, onDone }: Props) {
  const [choice, setChoice] = useState<RadioOption | null>(null);
  const [addressValue, setAddressValue] = useState<AddressValue | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    choice !== null &&
    (choice === "unknown" ||
      choice === "outside" ||
      (choice === "inside" && addressValueComplete(addressValue)));

  function handleChoiceChange(next: RadioOption) {
    setChoice(next);
    setAddressValue(null);
    setError(null);
  }

  function handleSubmit() {
    if (!choice) return;
    setError(null);

    if (choice === "unknown") {
      onDone();
      return;
    }

    const input: ClassifyTeamMemberInput = {
      personId,
      isOutOfDistrict: choice === "outside",
      ...(addressValue ?? {}),
    };

    startTransition(async () => {
      const result = await classifyTeamMember(input);
      if (result.error) {
        setError(result.error);
      } else {
        onDone();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => { if (e.target === e.currentTarget) onDone(); }}
    >
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            Add {name} to your people list
          </h2>
          <button
            type="button"
            onClick={onDone}
            aria-label="Close"
            className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-slate-700 mb-4">
            Where does {name} live?
          </p>

          <div className="flex flex-col gap-3">
            {/* Inside the district */}
            <label
              className={[
                "rounded-2xl border px-4 py-3 cursor-pointer transition-colors",
                choice === "inside"
                  ? "border-brand-400 bg-brand-50"
                  : "border-slate-200 hover:border-slate-300",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="district_choice"
                  value="inside"
                  checked={choice === "inside"}
                  onChange={() => handleChoiceChange("inside")}
                  className="mt-0.5 h-4 w-4 text-brand-600 border-slate-300 focus:ring-brand-500"
                />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-slate-900">Inside the district</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Address is required.
                  </p>
                </div>
              </div>
              {choice === "inside" && (
                <div className="mt-3 pl-7">
                  <AddressPicker onChange={setAddressValue} />
                </div>
              )}
            </label>

            {/* Outside the district */}
            <label
              className={[
                "rounded-2xl border px-4 py-3 cursor-pointer transition-colors",
                choice === "outside"
                  ? "border-brand-400 bg-brand-50"
                  : "border-slate-200 hover:border-slate-300",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="district_choice"
                  value="outside"
                  checked={choice === "outside"}
                  onChange={() => handleChoiceChange("outside")}
                  className="mt-0.5 h-4 w-4 text-brand-600 border-slate-300 focus:ring-brand-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-900">Outside the district</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Address optional. Added to out-of-district list.
                  </p>
                </div>
              </div>
            </label>

            {/* I don't know yet */}
            <label
              className={[
                "rounded-2xl border px-4 py-3 cursor-pointer transition-colors",
                choice === "unknown"
                  ? "border-slate-300 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="district_choice"
                  value="unknown"
                  checked={choice === "unknown"}
                  onChange={() => handleChoiceChange("unknown")}
                  className="mt-0.5 h-4 w-4 text-brand-600 border-slate-300 focus:ring-brand-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-900">
                    I don&apos;t know yet
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    They&apos;ll appear in the district classification queue.
                  </p>
                </div>
              </div>
            </label>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onDone}
            disabled={isPending}
            className="h-10 px-4 rounded-2xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            className="h-10 px-5 rounded-2xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
