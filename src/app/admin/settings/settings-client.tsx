"use client";

import { useState } from "react";
import { updatePlatformSettings } from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  initialSettings: Record<string, string>;
  canEdit: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

// ── Helpers ────────────────────────────────────────────────────────────────

function get(settings: Record<string, string>, key: string, fallback = ""): string {
  return settings[key] ?? fallback;
}

function InlineStatus({
  state,
  errorMessage,
}: {
  state: SaveState;
  errorMessage?: string;
}) {
  if (state === "saved") {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
        <p className="text-sm text-emerald-700 font-medium">Saved.</p>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
        <p className="text-sm text-red-600">{errorMessage ?? "Save failed."}</p>
      </div>
    );
  }
  return null;
}

const INPUT_CLASS =
  "h-9 rounded-lg border border-slate-200 hover:border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed";

const SAVE_BTN =
  "h-9 px-4 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0";

const READ_ONLY_BTN =
  "h-9 px-4 rounded-lg bg-slate-100 text-slate-400 text-sm font-semibold cursor-not-allowed flex-shrink-0";

// ── Section 1: Tier Pricing ────────────────────────────────────────────────

const TIERS = [
  { key: "starter",  label: "Starter"  },
  { key: "campaign", label: "Campaign" },
  { key: "election", label: "Election" },
] as const;

function PricingSection({
  initialSettings,
  canEdit,
}: {
  initialSettings: Record<string, string>;
  canEdit: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const t of TIERS) {
      init[`${t.key}_label`] = get(initialSettings, `${t.key}_label`, t.label);
      init[`${t.key}_price`] = get(initialSettings, `${t.key}_price`, "0");
    }
    return init;
  });

  const [states, setStates] = useState<Record<string, SaveState>>(() =>
    Object.fromEntries(TIERS.map((t) => [t.key, "idle" as SaveState])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function saveTier(tier: string) {
    setStates((prev) => ({ ...prev, [tier]: "saving" }));
    setErrors((prev) => ({ ...prev, [tier]: "" }));

    const updates: Record<string, string> = {
      [`${tier}_label`]: values[`${tier}_label`].trim(),
      [`${tier}_price`]: values[`${tier}_price`],
    };

    const result = await updatePlatformSettings(updates);

    if (result.error) {
      setStates((prev) => ({ ...prev, [tier]: "error" }));
      setErrors((prev) => ({ ...prev, [tier]: result.error! }));
    } else {
      setStates((prev) => ({ ...prev, [tier]: "saved" }));
      setTimeout(() => {
        setStates((prev) => ({ ...prev, [tier]: "idle" }));
      }, 3000);
    }
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Tier Pricing &amp; Labels</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Labels appear in the UI. Prices are stored for reference — no payment processing is connected.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {TIERS.map((t) => (
          <div key={t.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t.label}</p>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Label</label>
              <input
                type="text"
                value={values[`${t.key}_label`]}
                onChange={(e) => handleChange(`${t.key}_label`, e.target.value)}
                disabled={!canEdit || states[t.key] === "saving"}
                className={INPUT_CLASS + " w-full"}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Price (CAD / mo)</label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-400">$</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={values[`${t.key}_price`]}
                  onChange={(e) => handleChange(`${t.key}_price`, e.target.value)}
                  disabled={!canEdit || states[t.key] === "saving"}
                  className={INPUT_CLASS + " w-full"}
                />
              </div>
            </div>

            <InlineStatus state={states[t.key]} errorMessage={errors[t.key]} />

            {canEdit ? (
              <button
                onClick={() => saveTier(t.key)}
                disabled={states[t.key] === "saving"}
                className={SAVE_BTN + " w-full"}
              >
                {states[t.key] === "saving" ? "Saving…" : "Save"}
              </button>
            ) : (
              <button disabled className={READ_ONLY_BTN + " w-full"}>
                Read-only
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Section 2: Tier Limits ─────────────────────────────────────────────────

const LIMIT_ROWS = [
  { label: "Constituent limit",      keyFragment: "constituent_limit"      },
  { label: "Canvasser limit",        keyFragment: "canvasser_limit"        },
  { label: "Campaign Manager limit", keyFragment: "campaign_manager_limit" },
  { label: "Co-Chair limit",         keyFragment: "cochair_limit"          },
  { label: "Field Organizer limit",  keyFragment: "field_organizer_limit"  },
] as const;

function LimitsSection({
  initialSettings,
  canEdit,
}: {
  initialSettings: Record<string, string>;
  canEdit: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const t of TIERS) {
      for (const row of LIMIT_ROWS) {
        const key = `${t.key}_${row.keyFragment}`;
        init[key] = get(initialSettings, key, "0");
      }
    }
    return init;
  });

  const [state, setState]     = useState<SaveState>("idle");
  const [errMsg, setErrMsg]   = useState("");

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (state !== "idle") setState("idle");
  }

  async function saveLimits() {
    setState("saving");
    setErrMsg("");

    const updates: Record<string, string> = {};
    for (const t of TIERS) {
      for (const row of LIMIT_ROWS) {
        const key = `${t.key}_${row.keyFragment}`;
        updates[key] = values[key];
      }
    }

    const result = await updatePlatformSettings(updates);

    if (result.error) {
      setState("error");
      setErrMsg(result.error);
    } else {
      setState("saved");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Tier Limits</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Set numeric seat and constituent limits per tier. These are enforced at the API layer.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide w-52">
                  Limit
                </th>
                {TIERS.map((t) => (
                  <th key={t.key} className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide text-center">
                    {t.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {LIMIT_ROWS.map((row) => (
                <tr key={row.keyFragment} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 text-slate-700 font-medium whitespace-nowrap">
                    {row.label}
                  </td>
                  {TIERS.map((t) => {
                    const key = `${t.key}_${row.keyFragment}`;
                    return (
                      <td key={t.key} className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={values[key]}
                          onChange={(e) => handleChange(key, e.target.value)}
                          disabled={!canEdit || state === "saving"}
                          className={INPUT_CLASS + " w-24 text-center"}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-slate-500">0&nbsp;=&nbsp;unlimited.</span>{" "}
            Set to 0 to remove the cap for that tier.
          </p>
          <div className="flex items-center gap-3">
            <InlineStatus state={state} errorMessage={errMsg} />
            {canEdit ? (
              <button
                onClick={saveLimits}
                disabled={state === "saving"}
                className={SAVE_BTN}
              >
                {state === "saving" ? "Saving…" : "Save limits"}
              </button>
            ) : (
              <button disabled className={READ_ONLY_BTN}>
                Read-only
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Section 3: Feature Matrix (static) ────────────────────────────────────

const FEATURE_ROWS = [
  { label: "Donor tracking",           starter: false, campaign: true,  election: true  },
  { label: "Volunteer coordination",   starter: false, campaign: true,  election: true  },
  { label: "Finance Lead access",      starter: false, campaign: true,  election: true  },
  { label: "Co-Chair seats",           starter: false, campaign: true,  election: true  },
  { label: "Unlimited canvassers",     starter: false, campaign: true,  election: true  },
  { label: "Unlimited constituents",   starter: false, campaign: false, election: true  },
];

function Check({ yes }: { yes: boolean }) {
  if (yes) {
    return (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 mx-auto">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-300 mx-auto">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
}

function FeatureMatrixSection() {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Feature Availability</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Feature availability is currently configured in code. This will become editable in a future update.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide w-52">
                  Feature
                </th>
                {TIERS.map((t) => (
                  <th key={t.key} className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide text-center">
                    {t.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {FEATURE_ROWS.map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 text-slate-700 font-medium">{row.label}</td>
                  <td className="px-4 py-3"><div className="flex justify-center"><Check yes={row.starter} /></div></td>
                  <td className="px-4 py-3"><div className="flex justify-center"><Check yes={row.campaign} /></div></td>
                  <td className="px-4 py-3"><div className="flex justify-center"><Check yes={row.election} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ── Root client component ──────────────────────────────────────────────────

export function SettingsClient({ initialSettings, canEdit }: Props) {
  return (
    <div className="flex flex-col gap-10">
      {!canEdit && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
          <p className="text-sm text-amber-700">
            You are viewing these settings in read-only mode. Only <span className="font-semibold">super_user</span> accounts can save changes.
          </p>
        </div>
      )}

      <PricingSection initialSettings={initialSettings} canEdit={canEdit} />
      <LimitsSection  initialSettings={initialSettings} canEdit={canEdit} />
      <FeatureMatrixSection />
    </div>
  );
}
