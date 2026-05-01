"use client";

import { useState } from "react";
import { updatePlatformSettings, forceLogoutAllUsers } from "./actions";

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

// ── Section 0: System Status ──────────────────────────────────────────────

type ForceLogoutState = "idle" | "confirm" | "loading" | "done" | "error";

function SystemStatusSection({
  initialSettings,
  canEdit,
}: {
  initialSettings: Record<string, string>;
  canEdit: boolean;
}) {
  const [maintenanceOn, setMaintenanceOn] = useState(
    initialSettings["maintenance_mode"] === "true",
  );
  const [toggling, setToggling]           = useState(false);
  const [toggleError, setToggleError]     = useState("");

  const [forceState, setForceState]       = useState<ForceLogoutState>("idle");
  const [forceError, setForceError]       = useState("");

  async function handleMaintenanceToggle(next: boolean) {
    setToggling(true);
    setToggleError("");
    const result = await updatePlatformSettings({ maintenance_mode: next ? "true" : "false" });
    setToggling(false);
    if (result.error) {
      setToggleError(result.error);
    } else {
      setMaintenanceOn(next);
    }
  }

  async function handleForceLogout() {
    if (forceState === "idle") {
      setForceState("confirm");
      return;
    }
    if (forceState === "confirm") {
      setForceState("loading");
      setForceError("");
      const result = await forceLogoutAllUsers();
      if (result.error) {
        setForceState("error");
        setForceError(result.error);
      } else {
        setForceState("done");
      }
    }
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">System Status</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Control platform availability and session state. Use these tools during deployments or security incidents.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
        {/* Maintenance mode row */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <p className="text-sm font-semibold text-slate-800">Maintenance mode</p>
              {maintenanceOn ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                  System is live
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              {maintenanceOn
                ? "All non-admin users are being redirected to the maintenance page."
                : "Turning on maintenance mode will redirect all non-admin users to a maintenance page. Existing sessions will continue until their next request."}
            </p>
            {toggleError && (
              <p className="mt-1.5 text-xs text-red-600">{toggleError}</p>
            )}
          </div>

          <div className="flex-shrink-0">
            {canEdit ? (
              <button
                type="button"
                role="switch"
                aria-checked={maintenanceOn}
                onClick={() => handleMaintenanceToggle(!maintenanceOn)}
                disabled={toggling}
                className={[
                  "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
                  maintenanceOn ? "bg-amber-500" : "bg-slate-200",
                  toggling ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200",
                    maintenanceOn ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
              </button>
            ) : (
              <button
                type="button"
                role="switch"
                aria-checked={maintenanceOn}
                disabled
                className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent bg-slate-200 opacity-60 cursor-not-allowed"
              >
                <span className="inline-block h-5 w-5 rounded-full bg-white shadow" />
              </button>
            )}
          </div>
        </div>

        {/* Force logout row */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">Force logout all users</p>
            {forceState === "confirm" ? (
              <p className="text-sm text-amber-700 mt-1 leading-relaxed font-medium">
                This will immediately invalidate all active sessions. Every user will need to log in again. Are you sure?
              </p>
            ) : forceState === "done" ? (
              <p className="text-sm text-emerald-700 mt-1 leading-relaxed">
                All sessions invalidated. Users will be redirected to login on their next request.
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Bumps the session version for all users, immediately invalidating every active session. Use this after a security concern or when session structure changes.
              </p>
            )}
            {forceState === "error" && (
              <p className="mt-1.5 text-xs text-red-600">{forceError}</p>
            )}
          </div>

          <div className="flex-shrink-0 flex items-center gap-2">
            {forceState === "confirm" && (
              <button
                onClick={() => setForceState("idle")}
                className="h-9 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            )}
            {canEdit && forceState !== "done" && (
              <button
                onClick={handleForceLogout}
                disabled={forceState === "loading"}
                className={[
                  "h-9 px-4 rounded-xl text-sm font-medium transition-colors",
                  forceState === "confirm"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-red-50 text-red-600 hover:bg-red-100",
                  forceState === "loading" ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {forceState === "loading"
                  ? "Invalidating…"
                  : forceState === "confirm"
                  ? "Yes, log everyone out"
                  : "Force logout all users"}
              </button>
            )}
            {forceState === "done" && (
              <button
                onClick={() => setForceState("idle")}
                className="h-9 px-4 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Done
              </button>
            )}
            {!canEdit && (
              <button disabled className={READ_ONLY_BTN}>Read-only</button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

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
      init[`${t.key}_label`]         = get(initialSettings, `${t.key}_label`, t.label);
      init[`${t.key}_regular_price`] = get(initialSettings, `${t.key}_regular_price`, "0");
      init[`${t.key}_sale_price`]    = get(initialSettings, `${t.key}_sale_price`, "");
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

    const saleRaw = values[`${tier}_sale_price`].trim();
    const updates: Record<string, string> = {
      [`${tier}_label`]:         values[`${tier}_label`].trim(),
      [`${tier}_regular_price`]: values[`${tier}_regular_price`],
      [`${tier}_sale_price`]:    saleRaw,
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
          Labels appear in the UI. Set a sale price to show strikethrough pricing on the marketing site and plan selection screen.
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
              <label className="text-sm font-medium text-slate-700">Regular price (CAD)</label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-400">$</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={values[`${t.key}_regular_price`]}
                  onChange={(e) => handleChange(`${t.key}_regular_price`, e.target.value)}
                  disabled={!canEdit || states[t.key] === "saving"}
                  className={INPUT_CLASS + " w-full"}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Sale price{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-400">$</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="—"
                  value={values[`${t.key}_sale_price`]}
                  onChange={(e) => handleChange(`${t.key}_sale_price`, e.target.value)}
                  disabled={!canEdit || states[t.key] === "saving"}
                  className={INPUT_CLASS + " w-full"}
                />
              </div>
              <p className="text-xs text-slate-400">
                When set, this is the price shown to users. The regular price appears crossed out.
              </p>
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

// ── Section 3: Feature Matrix (editable) ──────────────────────────────────

const FEATURE_ROWS = [
  { label: "Donor tracking",         key: "donor_tracking"          },
  { label: "Follow-up queue",        key: "follow_up_queue"         },
  { label: "Analytics",              key: "analytics"               },
  { label: "Volunteer coordination", key: "volunteer_coordination"  },
  { label: "Finance Lead access",    key: "finance_lead_access"     },
  { label: "Co-Chair seats",         key: "co_chair_seats"          },
  { label: "Unlimited canvassers",   key: "unlimited_canvassers"    },
  { label: "Unlimited constituents", key: "unlimited_constituents"  },
  { label: "Events",                 key: "events"                  },
  { label: "Surveys",                key: "surveys"                 },
  { label: "Digital signatures",     key: "digital_signatures"      },
  { label: "Custom fields",          key: "custom_fields"           },
  { label: "Sign tracking",          key: "sign_tracking"           },
  { label: "Contact map",            key: "contact_map"             },
  { label: "Reports",                key: "reports"                 },
  { label: "Canvassing script",      key: "canvass_script"          },
] as const;

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={[
        "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
        checked ? "bg-emerald-500" : "bg-slate-200",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
          checked ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

function FeatureMatrixSection({
  initialSettings,
  canEdit,
}: {
  initialSettings: Record<string, string>;
  canEdit: boolean;
}) {
  const [values, setValues] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const t of TIERS) {
      for (const row of FEATURE_ROWS) {
        const k = `${t.key}_feature_${row.key}`;
        init[k] = initialSettings[k] === "true";
      }
    }
    return init;
  });

  const [state, setState]   = useState<SaveState>("idle");
  const [errMsg, setErrMsg] = useState("");

  function handleToggle(key: string, val: boolean) {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (state !== "idle") setState("idle");
  }

  async function saveFeatures() {
    setState("saving");
    setErrMsg("");

    const updates: Record<string, string> = {};
    for (const t of TIERS) {
      for (const row of FEATURE_ROWS) {
        const k = `${t.key}_feature_${row.key}`;
        updates[k] = values[k] ? "true" : "false";
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
        <h2 className="text-base font-semibold text-slate-900">Feature Availability</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Control which features are enabled for each tier. Changes take effect immediately for new plan selections.
          Existing campaigns retain the best of their snapshot and current settings.
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
                <tr key={row.key} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3 text-slate-700 font-medium">{row.label}</td>
                  {TIERS.map((t) => {
                    const k = `${t.key}_feature_${row.key}`;
                    return (
                      <td key={t.key} className="px-4 py-3">
                        <div className="flex justify-center">
                          <Toggle
                            checked={values[k]}
                            onChange={(val) => handleToggle(k, val)}
                            disabled={!canEdit || state === "saving"}
                          />
                        </div>
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
            Toggling a feature off removes it from new plan selections but does not affect campaigns that already have it.
          </p>
          <div className="flex items-center gap-3">
            <InlineStatus state={state} errorMessage={errMsg} />
            {canEdit ? (
              <button
                onClick={saveFeatures}
                disabled={state === "saving"}
                className={SAVE_BTN}
              >
                {state === "saving" ? "Saving…" : "Save features"}
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

      <SystemStatusSection initialSettings={initialSettings} canEdit={canEdit} />
      <PricingSection      initialSettings={initialSettings} canEdit={canEdit} />
      <LimitsSection       initialSettings={initialSettings} canEdit={canEdit} />
      <FeatureMatrixSection initialSettings={initialSettings} canEdit={canEdit} />
    </div>
  );
}
