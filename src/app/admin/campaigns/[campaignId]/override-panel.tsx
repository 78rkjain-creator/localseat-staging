"use client";

import { useState } from "react";
import type { CampaignOverride } from "@prisma/client";
import type { SerializableLimits } from "./actions";
import { upsertCampaignOverride, getCampaignEffectiveLimits } from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  campaignId:            string;
  campaignPlan:          string;
  planActivated:         boolean;
  initialOverride:       CampaignOverride | null;
  initialEffectiveLimits: SerializableLimits;
}

type SaveState = "idle" | "saving" | "saved" | "error";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatLimit(value: number): string {
  return value === 0 ? "Unlimited" : value.toLocaleString();
}

/** Parse a string input to number | null. Blank → null, explicit value → number. */
function parseNum(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? null : n;
}

const INPUT_CLASS =
  "h-9 w-36 rounded-lg border border-slate-200 hover:border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed tabular-nums";

const SELECT_CLASS =
  "h-9 rounded-lg border border-slate-200 hover:border-slate-300 px-3 pr-8 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed bg-white";

// ── Field row ──────────────────────────────────────────────────────────────

function FieldRow({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4 py-3 border-b border-slate-100 last:border-0">
      <div className="w-48 flex-shrink-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {helper && <p className="text-xs text-slate-400 mt-0.5">{helper}</p>}
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

// ── Effective limits preview ───────────────────────────────────────────────

function EffectivePreview({ limits }: { limits: SerializableLimits }) {
  const rows = [
    { label: "Constituent limit",     value: formatLimit(limits.constituentLimit) },
    { label: "Canvasser limit",       value: formatLimit(limits.canvasserLimit)   },
    { label: "Co-Chair limit",        value: formatLimit(limits.coChairLimit)     },
    { label: "Field Organizer limit", value: formatLimit(limits.fieldOrganizerLimit) },
    { label: "Tag limit",             value: formatLimit(limits.tagLimit)         },
    { label: "Custom field limit",    value: formatLimit(limits.customFieldLimit) },
    { label: "Donor tracking",        value: limits.donorTrackingEnabled     ? "Enabled" : "Disabled" },
    { label: "Follow-up queue",       value: limits.followUpQueueEnabled     ? "Enabled" : "Disabled" },
    { label: "Analytics",             value: limits.analyticsEnabled         ? "Enabled" : "Disabled" },
    { label: "Events",                value: limits.eventsEnabled            ? "Enabled" : "Disabled" },
    { label: "Surveys",               value: limits.surveysEnabled           ? "Enabled" : "Disabled" },
    { label: "Digital signatures",    value: limits.digitalSignaturesEnabled ? "Enabled" : "Disabled" },
    { label: "Custom fields",         value: limits.customFieldsEnabled      ? "Enabled" : "Disabled" },
    { label: "Sign tracking",         value: limits.signTrackingEnabled      ? "Enabled" : "Disabled" },
    { label: "Contact map",           value: limits.contactMapEnabled        ? "Enabled" : "Disabled" },
    { label: "Reports",               value: limits.reportsEnabled           ? "Enabled" : "Disabled" },
    { label: "Canvassing script",     value: limits.canvassScriptEnabled     ? "Enabled" : "Disabled" },
  ];

  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Effective limits for this campaign
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Tier defaults + overrides applied</p>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="px-4 py-2.5 text-slate-500">{row.label}</td>
              <td className="px-4 py-2.5 font-semibold text-slate-800 text-right tabular-nums">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function OverridePanel({
  campaignId,
  campaignPlan,
  planActivated,
  initialOverride,
  initialEffectiveLimits,
}: Props) {
  const isDemo = campaignPlan === "demo";

  // Form state — strings for number inputs so blank is distinct from 0
  const [canvasserLimit,      setCanvasserLimit]      = useState(initialOverride?.canvasserLimit      != null ? String(initialOverride.canvasserLimit)      : "");
  const [extraCanvassers,     setExtraCanvassers]     = useState(initialOverride?.extraCanvassers      != null ? String(initialOverride.extraCanvassers)      : "");
  const [constituentLimit,    setConstituentLimit]    = useState(initialOverride?.constituentLimit     != null ? String(initialOverride.constituentLimit)     : "");
  const [coChairLimit,        setCoChairLimit]        = useState(initialOverride?.coChairLimit         != null ? String(initialOverride.coChairLimit)         : "");
  const [fieldOrganizerLimit, setFieldOrganizerLimit] = useState(initialOverride?.fieldOrganizerLimit  != null ? String(initialOverride.fieldOrganizerLimit)  : "");
  const [donorOverride,       setDonorOverride]       = useState<"" | "true" | "false">(
    initialOverride?.donorTrackingEnabled === true  ? "true"  :
    initialOverride?.donorTrackingEnabled === false ? "false" : "",
  );
  const [followUpOverride,    setFollowUpOverride]    = useState<"" | "true" | "false">(
    initialOverride?.followUpQueueEnabled === true  ? "true"  :
    initialOverride?.followUpQueueEnabled === false ? "false" : "",
  );
  const [analyticsOverride,          setAnalyticsOverride]          = useState<"" | "true" | "false">(
    initialOverride?.analyticsEnabled === true  ? "true"  :
    initialOverride?.analyticsEnabled === false ? "false" : "",
  );
  const [eventsOverride,             setEventsOverride]             = useState<"" | "true" | "false">(
    initialOverride?.eventsEnabled === true  ? "true"  :
    initialOverride?.eventsEnabled === false ? "false" : "",
  );
  const [surveysOverride,            setSurveysOverride]            = useState<"" | "true" | "false">(
    initialOverride?.surveysEnabled === true  ? "true"  :
    initialOverride?.surveysEnabled === false ? "false" : "",
  );
  const [digitalSigOverride,         setDigitalSigOverride]         = useState<"" | "true" | "false">(
    initialOverride?.digitalSignaturesEnabled === true  ? "true"  :
    initialOverride?.digitalSignaturesEnabled === false ? "false" : "",
  );
  const [customFieldsOverride,       setCustomFieldsOverride]       = useState<"" | "true" | "false">(
    initialOverride?.customFieldsEnabled === true  ? "true"  :
    initialOverride?.customFieldsEnabled === false ? "false" : "",
  );
  const [signTrackingOverride,       setSignTrackingOverride]       = useState<"" | "true" | "false">(
    initialOverride?.signTrackingEnabled === true  ? "true"  :
    initialOverride?.signTrackingEnabled === false ? "false" : "",
  );
  const [contactMapOverride,         setContactMapOverride]         = useState<"" | "true" | "false">(
    initialOverride?.contactMapEnabled === true  ? "true"  :
    initialOverride?.contactMapEnabled === false ? "false" : "",
  );
  const [reportsOverride,            setReportsOverride]            = useState<"" | "true" | "false">(
    initialOverride?.reportsEnabled === true  ? "true"  :
    initialOverride?.reportsEnabled === false ? "false" : "",
  );
  const [canvassScriptOverride,      setCanvassScriptOverride]      = useState<"" | "true" | "false">(
    initialOverride?.canvassScriptEnabled === true  ? "true"  :
    initialOverride?.canvassScriptEnabled === false ? "false" : "",
  );
  const [notes, setNotes] = useState(initialOverride?.notesInternal ?? "");

  const [saveState, setSaveState]     = useState<SaveState>("idle");
  const [errorMsg,  setErrorMsg]      = useState("");
  const [effectiveLimits, setEffectiveLimits] = useState<SerializableLimits>(initialEffectiveLimits);

  async function handleSave() {
    setSaveState("saving");
    setErrorMsg("");

    const result = await upsertCampaignOverride(campaignId, {
      canvasserLimit:       parseNum(canvasserLimit),
      extraCanvassers:      parseNum(extraCanvassers),
      constituentLimit:     parseNum(constituentLimit),
      coChairLimit:         parseNum(coChairLimit),
      fieldOrganizerLimit:  parseNum(fieldOrganizerLimit),
      donorTrackingEnabled:     donorOverride         === "true" ? true : donorOverride         === "false" ? false : null,
      followUpQueueEnabled:     followUpOverride      === "true" ? true : followUpOverride      === "false" ? false : null,
      analyticsEnabled:         analyticsOverride     === "true" ? true : analyticsOverride     === "false" ? false : null,
      eventsEnabled:            eventsOverride        === "true" ? true : eventsOverride        === "false" ? false : null,
      surveysEnabled:           surveysOverride       === "true" ? true : surveysOverride       === "false" ? false : null,
      digitalSignaturesEnabled: digitalSigOverride    === "true" ? true : digitalSigOverride    === "false" ? false : null,
      customFieldsEnabled:      customFieldsOverride  === "true" ? true : customFieldsOverride  === "false" ? false : null,
      signTrackingEnabled:      signTrackingOverride  === "true" ? true : signTrackingOverride  === "false" ? false : null,
      contactMapEnabled:        contactMapOverride     === "true" ? true : contactMapOverride     === "false" ? false : null,
      reportsEnabled:           reportsOverride       === "true" ? true : reportsOverride       === "false" ? false : null,
      canvassScriptEnabled:     canvassScriptOverride === "true" ? true : canvassScriptOverride === "false" ? false : null,
      notesInternal:            notes.trim() || null,
    });

    if (result.error) {
      setSaveState("error");
      setErrorMsg(result.error);
      return;
    }

    // Refresh effective limits preview
    const refreshed = await getCampaignEffectiveLimits(campaignId);
    if (refreshed) setEffectiveLimits(refreshed);

    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 4000);
  }

  // Plan badge
  const planLabel =
    campaignPlan === "demo"   ? "Demo"   :
    campaignPlan === "arena"  ? "Arena"  :
    campaignPlan === "stage"  ? "Stage"  :
    campaignPlan === "podium" ? "Podium" :
    campaignPlan === "chair"  ? "Chair"  :
    campaignPlan === "bench"  ? "Bench"  : campaignPlan;

  return (
    <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="px-6 py-5 border-b border-amber-200 bg-amber-50/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Campaign Overrides</h2>
            <p className="mt-0.5 text-xs text-amber-700">
              These settings override the tier defaults for this campaign only. Leave fields blank to use tier defaults.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white border border-amber-200 text-amber-800">
              {planLabel}
            </span>
            {isDemo ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 border border-purple-200 text-purple-700">
                Demo
              </span>
            ) : planActivated ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
                Active
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-600">
                Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-6">
        {/* Demo notice */}
        {isDemo && (
          <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3">
            <p className="text-sm text-purple-700">
              This is a demo campaign. All limits are bypassed regardless of overrides.
            </p>
          </div>
        )}

        {/* Inactive notice */}
        {!isDemo && !planActivated && (
          <div className="rounded-xl bg-slate-100 border border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-600">
              This campaign&apos;s plan is not yet activated. All limits are currently bypassed (unlimited access).
            </p>
          </div>
        )}

        {/* Override fields */}
        <div>
          <div className="divide-y divide-slate-100">
            <FieldRow label="Canvasser limit" helper="Leave blank to use tier default">
              <input
                type="number"
                min={0}
                step={1}
                value={canvasserLimit}
                onChange={(e) => setCanvasserLimit(e.target.value)}
                placeholder="Tier default"
                className={INPUT_CLASS}
              />
            </FieldRow>

            <FieldRow label="Extra canvassers" helper="Additive bonus on top of tier default">
              <input
                type="number"
                min={0}
                step={1}
                value={extraCanvassers}
                onChange={(e) => setExtraCanvassers(e.target.value)}
                placeholder="None"
                className={INPUT_CLASS}
              />
            </FieldRow>

            <FieldRow label="Constituent limit" helper="Leave blank to use tier default">
              <input
                type="number"
                min={0}
                step={1}
                value={constituentLimit}
                onChange={(e) => setConstituentLimit(e.target.value)}
                placeholder="Tier default"
                className={INPUT_CLASS}
              />
            </FieldRow>

            <FieldRow label="Co-Chair limit" helper="Leave blank to use tier default">
              <input
                type="number"
                min={0}
                step={1}
                value={coChairLimit}
                onChange={(e) => setCoChairLimit(e.target.value)}
                placeholder="Tier default"
                className={INPUT_CLASS}
              />
            </FieldRow>

            <FieldRow label="Field Organizer limit" helper="Leave blank to use tier default">
              <input
                type="number"
                min={0}
                step={1}
                value={fieldOrganizerLimit}
                onChange={(e) => setFieldOrganizerLimit(e.target.value)}
                placeholder="Tier default"
                className={INPUT_CLASS}
              />
            </FieldRow>

            <FieldRow label="Donor tracking" helper="Override tier default">
              <select
                value={donorOverride}
                onChange={(e) => setDonorOverride(e.target.value as "" | "true" | "false")}
                className={SELECT_CLASS}
              >
                <option value="">Use tier default</option>
                <option value="true">Force enabled</option>
                <option value="false">Force disabled</option>
              </select>
            </FieldRow>

            <FieldRow label="Follow-up queue" helper="Override tier default">
              <select
                value={followUpOverride}
                onChange={(e) => setFollowUpOverride(e.target.value as "" | "true" | "false")}
                className={SELECT_CLASS}
              >
                <option value="">Use tier default</option>
                <option value="true">Force enabled</option>
                <option value="false">Force disabled</option>
              </select>
            </FieldRow>

            <FieldRow label="Analytics" helper="Override tier default">
              <select
                value={analyticsOverride}
                onChange={(e) => setAnalyticsOverride(e.target.value as "" | "true" | "false")}
                className={SELECT_CLASS}
              >
                <option value="">Use tier default</option>
                <option value="true">Force enabled</option>
                <option value="false">Force disabled</option>
              </select>
            </FieldRow>

            <FieldRow label="Events" helper="Override tier default">
              <select
                value={eventsOverride}
                onChange={(e) => setEventsOverride(e.target.value as "" | "true" | "false")}
                className={SELECT_CLASS}
              >
                <option value="">Use tier default</option>
                <option value="true">Force enabled</option>
                <option value="false">Force disabled</option>
              </select>
            </FieldRow>

            <FieldRow label="Surveys" helper="Override tier default">
              <select
                value={surveysOverride}
                onChange={(e) => setSurveysOverride(e.target.value as "" | "true" | "false")}
                className={SELECT_CLASS}
              >
                <option value="">Use tier default</option>
                <option value="true">Force enabled</option>
                <option value="false">Force disabled</option>
              </select>
            </FieldRow>

            <FieldRow label="Digital signatures" helper="Override tier default">
              <select
                value={digitalSigOverride}
                onChange={(e) => setDigitalSigOverride(e.target.value as "" | "true" | "false")}
                className={SELECT_CLASS}
              >
                <option value="">Use tier default</option>
                <option value="true">Force enabled</option>
                <option value="false">Force disabled</option>
              </select>
            </FieldRow>

            <FieldRow label="Custom fields" helper="Override tier default">
              <select
                value={customFieldsOverride}
                onChange={(e) => setCustomFieldsOverride(e.target.value as "" | "true" | "false")}
                className={SELECT_CLASS}
              >
                <option value="">Use tier default</option>
                <option value="true">Force enabled</option>
                <option value="false">Force disabled</option>
              </select>
            </FieldRow>

            <FieldRow label="Sign tracking" helper="Override tier default">
              <select
                value={signTrackingOverride}
                onChange={(e) => setSignTrackingOverride(e.target.value as "" | "true" | "false")}
                className={SELECT_CLASS}
              >
                <option value="">Use tier default</option>
                <option value="true">Force enabled</option>
                <option value="false">Force disabled</option>
              </select>
            </FieldRow>

            <FieldRow label="Contact map" helper="Override tier default">
              <select
                value={contactMapOverride}
                onChange={(e) => setContactMapOverride(e.target.value as "" | "true" | "false")}
                className={SELECT_CLASS}
              >
                <option value="">Use tier default</option>
                <option value="true">Force enabled</option>
                <option value="false">Force disabled</option>
              </select>
            </FieldRow>

            <FieldRow label="Reports" helper="Override tier default">
              <select
                value={reportsOverride}
                onChange={(e) => setReportsOverride(e.target.value as "" | "true" | "false")}
                className={SELECT_CLASS}
              >
                <option value="">Use tier default</option>
                <option value="true">Force enabled</option>
                <option value="false">Force disabled</option>
              </select>
            </FieldRow>

            <FieldRow label="Canvassing script" helper="Override tier default">
              <select
                value={canvassScriptOverride}
                onChange={(e) => setCanvassScriptOverride(e.target.value as "" | "true" | "false")}
                className={SELECT_CLASS}
              >
                <option value="">Use tier default</option>
                <option value="true">Force enabled</option>
                <option value="false">Force disabled</option>
              </select>
            </FieldRow>

            <FieldRow label="Internal notes" helper="Reason for override — not shown to campaign">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Granted extra canvassers for municipal election push…"
                className="w-72 rounded-lg border border-slate-200 hover:border-slate-300 px-3 py-2 text-sm text-slate-900 italic placeholder:not-italic placeholder:text-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors resize-none"
              />
            </FieldRow>
          </div>
        </div>

        {/* Save feedback */}
        {saveState === "saved" && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
            <p className="text-sm text-emerald-700 font-medium">Overrides saved.</p>
          </div>
        )}
        {saveState === "error" && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-sm text-red-600">{errorMsg}</p>
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            Changes are logged to the audit trail.
          </p>
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="h-9 px-5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
          >
            {saveState === "saving" ? "Saving…" : "Save overrides"}
          </button>
        </div>

        {/* Effective limits preview */}
        <EffectivePreview limits={effectiveLimits} />
      </div>
    </div>
  );
}
